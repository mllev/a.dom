/*
Copyright 2023 Matthew Levenstein

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the “Software”), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED “AS IS”, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

#include <stdio.h>
#include <string.h>
#include <stdlib.h>

/* public API */
char *adom_compile_to_html(
  const char* src, /* adom src */
  const char* data, /* serialized json */
  int dlen
);

char *adom_compile_to_ir(
  const char* src, /* absolute path to adom file */
  const char* data /* serialized json */
);

char *adom_compile_ir_to_html(
  const char* src, /* absolute path to ir file */
  const char* data /* serialized json */
);

/* internal API*/
enum adom__value_type {
  ADOM_STRING,
  ADOM_INT,
  ADOM_FLOAT,
  ADOM_BOOLEAN,
  ADOM_OBJECT,
  ADOM_ARRAY,
  ADOM_NULL
};

const char *adom__keywords[] = {
  "tag",
  "each",
  "if",
  "in",
  "else",
  "import",
  "export",
  "yield",
  "on",
  "file",
  "let", /* remove maybe */
  "local",
  "global",
  "root",
  "nosync"
};

enum adom__token_type {
  /* match ordering of keywords above */
  ADOM_TOK_TAG,
  ADOM_TOK_EACH,
  ADOM_TOK_IF,
  ADOM_TOK_IN,
  ADOM_TOK_ELSE,
  ADOM_TOK_IMPORT,
  ADOM_TOK_EXPORT,
  ADOM_TOK_YIELD,
  ADOM_TOK_ON,
  ADOM_FOK_FILE,
  ADOM_TOK_LET,
  ADOM_TOK_LOCAL,
  ADOM_TOK_GLOBAL,

  ADOM_TOK_STRING,
  ADOM_TOK_INT,
  ADOM_TOK_FLOAT,
  ADOM_TOK_BOOLEAN,
  ADOM_TOK_SYMBOL,
  ADOM_TOK_KEYWORD, /* remove */
  ADOM_TOK_IDENTIFIER,
  ADOM_TOK_OP,
  ADOM_TOK_EOF
};

typedef enum adom__value_type adom__value_type;
typedef enum adom__token_type adom__token_type;

typedef struct adom__token adom__token;
typedef struct adom__context adom__context;

struct adom__token {
  adom__token_type type;
  union {
    char sym;
    const char *keyword;
    struct {
      unsigned int* data;
      int len;
    } ident;
    float numf;
    int numi;
  } value;
  int pos;
};

struct adom__context {
  struct {
    unsigned int *content;
    int len;
  } src;
  int cursor;
  int error;
  adom__token token;
};

unsigned int adom__get_code_point(FILE *file) {
  unsigned int p = 0;
  int c = fgetc(file);

  if (c == EOF) {
    return 0;
  } else if ((c & 0x80) == 0) {
    return c;
  } else if ((c & 0xe0) == 0xc0) {
    p = c & 0x1f;
    p = (p << 6) | (fgetc(file) & 0x3F);
  } else if ((c & 0xf0) == 0xe0) {
    p = c & 0x0f;
    p = (p << 6) | (fgetc(file) & 0x3f);
    p = (p << 6) | (fgetc(file) & 0x3f);
  } else if ((c & 0xf8) == 0xf0) {
    p = c & 0x07;
    p = (p << 6) | (fgetc(file) & 0x3f);
    p = (p << 6) | (fgetc(file) & 0x3f);
    p = (p << 6) | (fgetc(file) & 0x3f);
  }

  return p;
}

int adom__print_utf8(unsigned int p, char* out) {
  if (p < 0x80) {
    out[0] = p;
    return 1;
  } else if (p < 0x800) {
    out[0] = (p >> 6) | 0xc0;
    out[1] = (p & 0x3f) | 0x80;
    return 2;
  } else if (p < 0x10000) {
    out[0] = (p >> 12) | 0xe0;
    out[1] = ((p >> 6) & 0x3f) | 0x80;
    out[2] = (p & 0x3f) | 0x80;
    return 3;
  } else {
    out[0] = (p >> 18) | 0xf0;
    out[1] = ((p >> 12) & 0x3f) | 0x80;
    out[2] = ((p >> 6) & 0x3f) | 0x80;
    out[3] = (p & 0x3f) | 0x80;
    return 4;
  }
}

void adom__print_string(unsigned int* str, int length) {
  int i, j;
  char point[4];
  for (i = 0; i < length; i++) {
    int len = adom__print_utf8(str[i], point);
    for (j = 0; j < len; j++) putchar(point[j]);
  }
}

void *adom__alloc(size_t size) {
  void *buf = malloc(size);
  if (!buf) {
    fprintf(stderr, "Fatal: out of memory\n");
    exit(0);
  }
  return buf;
}

unsigned int *adom__read_file_utf8(const char *name, int *length) {
#ifndef ADOM_NO_FOPEN
  unsigned int *program;
  unsigned int code;
  size_t size;
  int i = 0;
  FILE *file = fopen(name, "r");

  if (file == NULL) {
    fprintf(stderr, "Error opening file: %s\n", name);
    return NULL;
  }

  fseek(file, 0, SEEK_END);
  size = ftell(file);
  fseek(file, 0, 0);

  program = (unsigned int *)adom__alloc(size * (sizeof(unsigned int)));

  while ((code = adom__get_code_point(file)) != 0) {
    program[i++] = code;
  }

  *length = i;
  fclose(file);

  return program;
#else
  return NULL;
#endif
}

int adom__is_keyword(const unsigned int *ident, int length) {
  int i;
  for (i = 0; i < 15; i++) {
    const char* key = adom__keywords[i];
    int len = strlen(key);
    int j = 0, found = 1;
    if (len != length) {
      continue;
    }
    for (j = 0; j < len; j++) {
      if (key[j] != (char)ident[j]) {
        found = 0;
        break;
      }
    }
    if (found) {
      return i;
    }
  }
  return 0;
}

#define adom__is_ascii(x) (((x)&0x80)==0)
#define adom__is_num(x) (adom__is_ascii(x) && (char)x >= '0' && (char)x <= '9')
#define adom__is_newline(x) (adom__is_ascii(x) && ((char)x == '\n' || (char)x == '\r'))
#define adom__is_space(x) (adom__is_ascii(x) && ((char)x == ' ' || (char)x == '\t' || (char)x == '\n' || (char)x == '\r'))
#define adom__match(x, c) (adom__is_ascii(x) && ((char)(x) == (c)))

void adom__print_error(adom__context *ctx, const char *msg, int pos) {
  unsigned int *prog = ctx->src.content;
  int max = ctx->src.len;
  int start = pos;
  int end = pos;
  int i;
  while (1) {
    if (start == 0) break;
    if (adom__is_newline(prog[start])) {
      start++;
      break;
    }
    start--;
  }
  while (1) {
    if (end == max-1) break;
    if (adom__is_newline(prog[end])) {
      end--;
      break;
    }
    end++;
  }
  printf("%s:\n", msg);
  adom__print_string(&(prog[start]), end - start);
  printf("\n");
  for (i = 0; i < (pos - start); i++) {
    printf("-");
  }
  printf("^\n");
  ctx->error = 1;
}


int adom__is_symbol(unsigned int c) {
  int i;
  const char symlist[] = {
    '.', '=', '[', ']', ';', '{', '}', '(', ')', ':', ',', '?', '\'', '"', '`'
  };
  for (i = 0; i < 15; i++) {
    if (adom__match(c, symlist[i])) {
      return 1;
    }
  }
  return 0;
}

int adom__is_op(unsigned int c) {
  int i;
  const char symlist[] = {
    '>', '<', '|', '+', '/', '-', '*', '%', '!'
  };
  for (i = 0; i < 9; i++) {
    if (adom__match(c, symlist[i])) {
      return 1;
    }
  }
  return 0;
}

int adom__parse_num(unsigned int *ptr, float *fres, int *ires) {
  float num = 0.0;
  int d = 0;
  float div = 10.0;
  while (adom__is_num(*ptr) || (adom__match(*ptr, '.') && !d)) {
    if (adom__match(*ptr, '.')) d = 1;
    else if (d) {
      num += (float)((char)*ptr - '0') / div;
      div *= 10.0;
    } else {
      num = (num * 10.0) + (float)((char)*ptr - '0');
    }
    ptr++;
  }
  if (!d) {
    *ires = (int)num;
    return 0;
  }
  *fres = num;
  return 1;
}

int adom__init(adom__context *ctx, const char *file) {
  int length;
  unsigned int *prog;
  prog = adom__read_file_utf8(file, &length);
  if (!prog) return 1;
  ctx->src.content = prog;
  ctx->src.len = length;
  ctx->cursor = 0;
  ctx->error = 0;
  return 0;
}

void adom__destroy(adom__context *ctx) {
  free(ctx->src.content);
}

void adom__next(adom__context *ctx) {
  unsigned int c, c2;
  int kidx;
  const char *keyword;
  int i = ctx->cursor;
  unsigned int *prog = ctx->src.content;
  int length = ctx->src.len;

  /* skip white space */
  while (adom__is_space(prog[i])) {
    i++;
  }

  if (i >= length) {
    ctx->token.type = ADOM_TOK_EOF;
    return 0;
  }

  c  = prog[i];
  c2 = prog[i+1];

  if (adom__match(c, '"') || adom__match(c, '\'') || adom__match(c, '`')) {
    unsigned int* ptr;
    int len = 0;
    char del = (char)c;
    int start = i;

    ptr = &(prog[++i]);

    while (1) {
      if ((del != '`' && adom__is_newline(prog[i])) || (i >= length)) {
        adom__print_error(ctx, "Unterminated string", start);
        return 0;
      }
      if (adom__match(prog[i], del)) {
        if (!adom__match(prog[i-1], '\\')) {
          break;
        }
      }
      /* todo: handle escape characters */
      len++;
      i++;
    }
    ctx->token.type = ADOM_TOK_STRING;
    ctx->token.value.ident.data = ptr;
    ctx->token.value.ident.len = len;
    goto done;
  }

  if (adom__match(c, '/') && adom__match(c2, '/')) {
    while (1) {
      if (i >= length || adom__match(prog[i], '\n')) {
        break;
      }
      i++;
    }
    goto done;
  }

  if (adom__match(c, '/') && adom__match(c2, '*')) {
    while (1) {
      if (i >= length) break;
      if (adom__match(prog[i], '*') && adom__match(prog[i+1], '/')) {
        i++;
        break;
      }
      i++;
    }
    goto done;
  }

  if (adom__is_num(c)) {
    unsigned int* ptr = &(prog[i]);
    int len = 0;
    int d = 0;
    float fres;
    int ires;
    while (1) {
      if (i >= length) break;
      if (adom__match(prog[i], '.')) {
        if (d == 1) break;
        d = 1;
      } else if (!adom__is_num(prog[i])) {
        break;
      }
      i++;
      len++;
    }
    if (adom__parse_num(ptr, &fres, &ires)) {
      ctx->token.type = ADOM_TOK_FLOAT;
      ctx->token.value.numf = fres;
    } else {
      ctx->token.type = ADOM_TOK_INT;
      ctx->token.value.numi = ires;
    }
    goto done;
  }

  if (adom__match(c, '-') && adom__is_num(c2)) {
    int len = 0;
    float fres;
    int ires;
    unsigned int* ptr = &(prog[i++]);
    int d = 0;
    len++;
    while (1) {
      if (i >= length) break;
      if (adom__match(prog[i], '.') && !d) {
        d = 1;
      } else if (!adom__is_num(prog[i])) {
        break;
      }
      i++;
      len++;
    }
    ptr++;
    if (adom__parse_num(ptr, &fres, &ires)) {
      ctx->token.type = ADOM_TOK_FLOAT;
      ctx->token.value.numf = fres * -1;
    } else {
      ctx->token.type = ADOM_TOK_INT;
      ctx->token.value.numi = ires * -1;
    }
    goto done;
  }

  if (adom__is_op(c)) {
    ctx->token.type = ADOM_TOK_OP;
    ctx->token.value.sym = (char)c;
    goto done;
  }

  if (adom__is_symbol(c)) {
    ctx->token.type = ADOM_TOK_SYMBOL;
    ctx->token.value.sym = (char)c;
    goto done;
  }

  {
    int len = 0;
    unsigned int* ptr = &(prog[i]);

    while (
      !adom__is_space(prog[i])  &&
      !adom__is_symbol(prog[i]) &&
      !adom__is_op(prog[i])
    ) {
      len++;
      i++;
    }

    kidx = adom__is_keyword(ptr, len);
    keyword = ado__keywords[kidx];

    if (keyword) {
      ctx->token.type = (adom__token_type)kidx;
      ctx->token.value.keyword = keyword;
    } else {
      ctx->token.type = ADOM_TOK_IDENTIFIER;
      ctx->token.value.ident.data = ptr;
      ctx->token.value.ident.len = len;
    }
    goto done;
  }
  return 0;
done:
  ctx->cursor = i+1;
  return 1;
}

void adom__print_token(adom__context *adom) {
  switch (adom->token.type) {
    case ADOM_TOK_STRING: {
      printf("STRING: ");
      adom__print_string(adom->token.value.ident.data, adom->token.value.ident.len);
      printf("\n");
      break;
    }
    case ADOM_TOK_INT: {
      printf("PARSED NUMBER: %d\n", adom->token.value.numi);
      break;
    }
    case ADOM_TOK_FLOAT: {
      printf("PARSED NUMBER: %f\n", adom->token.value.numf);
      break;
    }
    case ADOM_TOK_SYMBOL: {
      printf("SYMBOL: %c\n", adom->token.value.sym);
      break;
    }
    case ADOM_TOK_OP: {
      printf("OPERATOR: %c\n", adom->token.value.sym);
      break;
    }
    case ADOM_TOK_IDENTIFIER: {
      printf("IDENTIFIER: ");
      adom__print_string(adom->token.value.ident.data, adom->token.value.ident.len);
      printf("\n");
      break;
    }
    case ADOM_TOK_KEYWORD: {
      printf("KEYWORD: %s\n", adom->token.value.keyword);
      break;
    }
    default: {
      break;
    }
  }
}

int adom__accept(adom__context *ctx, adom__token_type type) {
  if (ctx->token.type == type) {
    adom__next(ctx);
    return 1;
  }
  return 0;
}

#define adom__expect(ctx, type) if (!_adom__expect(ctx, type)) return 0;
int _adom__expect(adom__context *ctx, adom__token_type type) {
  if (ctx->token.type == type) {
    adom__next(ctx);
    return 1;
  }
  adom__print_error(ctx, "Unexpected token", ctx->token.pos);
  return 0;
}

#define adom__handle_err(ctx) if (ctx->error) return 0;

#define adom__parse_expr(ctx) if (!_adom__parse_expr(ctx)) return 0;
int _adom__parse_expr(adom__context *ctx) {
  adom__handle_err(ctx);
  return 1;
}

int adom__parse_file(adom__context *ctx) {
  adom__handle_err(ctx);
  while (1) {
    if (adom__accept(ctx, ADOM_TOK_IMPORT)) {
      adom__expect(ctx, ADOM_TOK_STRING);
    } else if (adom__accept(ctx, ADOM_TOK_LET)) {
      adom__expect(ctx, ADOM_TOK_IDENTIFIER);
      adom__expect(ctx, ADOM_TOK_SYMBOL); /* expect = */
      adom__parse_expr(ctx);
    } else {
      adom__print_error(ctx, "Unexpected token", ctx->token.pos);
      return 0;
    }
  }
  return 1;
}

char *adom_compile_to_html(const char* file, const char* data, int dlen) {
  adom__context adom;
  char *out;

  if (adom__init(&adom, file)) {
    return NULL;
  }

  while (adom__next(&adom)) {
    adom__print_token(&adom);
  }

  return out;
}

int main(int argc, char *argv[]) {
  char *html;

  if (argc < 2) {
    fprintf(stderr, "Usage: %s FILENAME\n", argv[0]);
    return 1;
  }

  html = adom_compile_to_html(argv[1], NULL, 0);
  /* free(html); */

  return 0;
}

