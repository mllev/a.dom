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
  "global"
};

const char *adom__pipeables[] = {
  "repeat",
  "length",
  "map",
  "filter",
  "toupper",
  "tolower",
  "split",
  "includes",
  "indexof",
  "reverse",
  "tojson",
  "replace",
  "replaceall",
  "tostring",
  "join",
  "keys",
  "values"
};

const char* adom__op_name[] = {
  "OP_IADD",
  "OP_ISUB",
  "OP_IMUL",
  "OP_IDIV",
  "OP_ILT",
  "OP_IGT",
  "OP_IGE",
  "OP_ILE",
  "OP_IEQ",
  "OP_FPSH",
  "OP_FADD",
  "OP_FSUB",
  "OP_FMUL",
  "OP_FDIV",
  "OP_FGT",
  "OP_FGE",
  "OP_FLE",
  "OP_FEQ",
  "OP_LD",
  "OP_ST",
  "OP_JMPZ",
  "OP_JMPN",
  "OP_CALL",
  "OP_RET",
  "OP_EXIT",
  "OP_PSH",
  "OP_IPUT",
  "OP_SPUT",
  "OP_NL"
};

const int adom__pipe_args[] = {
  1, 0, 1, 1, 0, 0, 1, 1, 1, 0, 0, 2, 2, 0, 1, 0, 0
};

const char adom__symbols[] = {
  '.', '=', '[', ']', '{', '}', '(', ')', ':', ',',
  '?', '>', '<', '|', '+', '-', '/', '*', '%', '!'
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

  /*  match ordering of symbols above */
  ADOM_TOK_DOT,
  ADOM_TOK_EQ,
  ADOM_TOK_LBRACK,
  ADOM_TOK_RBRACK,
  ADOM_TOK_LBRACE,
  ADOM_TOK_RBRACE,
  ADOM_TOK_LPAREN,
  ADOM_TOK_RPAREN,
  ADOM_TOK_COLON,
  ADOM_TOK_COMMA,
  ADOM_TOK_QMARK,
  ADOM_TOK_GT,
  ADOM_TOK_LT,
  ADOM_TOK_PIPE,
  ADOM_TOK_PLUS,
  ADOM_TOK_MINUS,
  ADOM_TOK_DIV,
  ADOM_TOK_MULT,
  ADOM_TOK_MOD,
  ADOM_TOK_NOT,

  ADOM_TOK_ISEQ,
  ADOM_TOK_LEQ,
  ADOM_TOK_GEQ,
  ADOM_TOK_NEQ,
  ADOM_TOK_OR,
  ADOM_TOK_AND,

  ADOM_TOK_STRING,
  ADOM_TOK_FLOAT,
  ADOM_TOK_BOOL,
  ADOM_TOK_NULL,
  ADOM_TOK_IDENTIFIER,
  ADOM_TOK_JS,
  ADOM_TOK_PIPEABLE,
  ADOM_TOK_EOF
};

enum adom__op {
  ADOM_OP_IADD,
  ADOM_OP_ISUB,
  ADOM_OP_IMUL,
  ADOM_OP_IDIV,
  ADOM_OP_ILT,
  ADOM_OP_IGT,
  ADOM_OP_IGE,
  ADOM_OP_ILE,
  ADOM_OP_IEQ,
  ADOM_OP_FADD,
  ADOM_OP_FSUB,
  ADOM_OP_FMUL,
  ADOM_OP_FDIV,
  ADOM_OP_FLT,
  ADOM_OP_FGT,
  ADOM_OP_FGE,
  ADOM_OP_FLE,
  ADOM_OP_FEQ,
  ADOM_OP_LD,
  ADOM_OP_ST,
  ADOM_OP_JMPZ,
  ADOM_OP_JMPN,
  ADOM_OP_CALL,
  ADOM_OP_RET,
  ADOM_OP_EXIT,
  ADOM_OP_PSH,
  ADOM_OP_IPUT,
  ADOM_OP_SPUT,
  ADOM_OP_NL
};

#ifdef uint32_t
  #define u32 uint32_t
#else
  #define u32 unsigned int
#endif

#define f64 double

typedef enum adom__value_type adom__value_type;
typedef enum adom__token_type adom__token_type;
typedef enum adom__op adom__op;

typedef struct adom__token adom__token;
typedef struct adom__context adom__context;

struct adom__token {
  adom__token_type type;
  union {
    char sym;
    struct {
      unsigned int* data;
      int len;
    } ident;
    float num;
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

/* utilities */
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

/* lexing */
#define adom__is_ascii(x) (((x)&0x80)==0)
#define adom__is_num(x) (adom__is_ascii(x) && (char)x >= '0' && (char)x <= '9')
#define adom__is_alpha(x) (adom__is_ascii(x) && (((char)x >= 'a' && (char)x <= 'z') || ((char)x >= 'A' && (char)x <= 'Z' )))
#define adom__is_newline(x) (adom__is_ascii(x) && ((char)x == '\n' || (char)x == '\r'))
#define adom__is_space(x) (adom__is_ascii(x) && ((char)x == ' ' || (char)x == '\t' || (char)x == '\n' || (char)x == '\r'))
#define adom__match(x, c) (adom__is_ascii(x) && ((char)(x) == (c)))

void adom__print_token(adom__context *adom) {
  if (adom->token.type < 13) {
    printf("%s", adom__keywords[adom->token.type]);
    return;
  }
  if (adom->token.type < 33) {
    printf("%c", adom__symbols[adom->token.type - 13]);
    return;
  }
  switch (adom->token.type) {
    case ADOM_TOK_STRING: {
      adom__print_string(adom->token.value.ident.data, adom->token.value.ident.len);
      break;
    }
    case ADOM_TOK_FLOAT: {
      printf("%f", adom->token.value.num);
      break;
    }
    case ADOM_TOK_NULL: {
      printf("null");
      break;
    }
    case ADOM_TOK_BOOL: {
      const char *t = "true";
      const char *f = "false";
      printf("%s", adom->token.value.sym ? t : f);
      break;
    }
    case ADOM_TOK_IDENTIFIER: {
      adom__print_string(adom->token.value.ident.data, adom->token.value.ident.len);
      break;
    }
    case ADOM_TOK_LEQ: {
      printf("<=");
      break;
    }
    case ADOM_TOK_GEQ: {
      printf(">=");
      break;
    }
    case ADOM_TOK_NEQ: {
      printf("!=");
      break;
    }
    case ADOM_TOK_ISEQ: {
      printf("==");
      break;
    }
    case ADOM_TOK_OR: {
      printf("||");
      break;
    }
    case ADOM_TOK_AND: {
      printf("&&");
      break;
    }
    case ADOM_TOK_PIPEABLE: {
      printf("%s", adom__pipeables[(int)adom->token.value.sym]);
      break;
    }
    default: {
      break;
    }
  }
}

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
  if (pos > -1) {
    printf("%s: ", msg);
    adom__print_token(ctx);
    printf("\n");
  } else {
    printf("%s\n", msg);
  }
  adom__print_string(&(prog[start]), end - start);
  printf("\n");
  for (i = 0; i < (pos - start); i++) {
    printf("-");
  }
  printf("^\n");
  ctx->error = 1;
}



int adom__match_str(unsigned int* ident, int length, const char *str) {
  int len = strlen(str);
  int i = 0;
  if (len != length) {
    return 0;
  }
  for (i = 0; i < len; i++) {
    if (!adom__match(ident[i], str[i])) {
      return 0;
    }
  }
  return 1;
}

int adom__is_keyword(unsigned int *ident, int length) {
  int i;
  for (i = 0; i < 13; i++) {
    const char* key = adom__keywords[i];
    if (adom__match_str(ident, length, key)) {
      return i;
    }
  }
  return -1;
}

int adom__is_pipeable(unsigned int *ident, int length) {
  int i;
  for (i = 0; i < 17; i++) {
    const char* key = adom__pipeables[i];
    if (adom__match_str(ident, length, key)) {
      return i;
    }
  }
  return -1;
}

int adom__is_symbol(unsigned int c) {
  int i;
  for (i = 0; i < 20; i++) {
    if (adom__match(c, adom__symbols[i])) {
      return i + 13;
    }
  }
  return -1;
}

float adom__parse_num(unsigned int *ptr) {
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
  return num;
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

int adom__next(adom__context *ctx) {
  unsigned int c, c2;
  int kidx, pidx;
  int i = ctx->cursor;
  unsigned int *prog = ctx->src.content;
  int length = ctx->src.len;
  int symbol;
begin:
  /* skip white space */
  while (adom__is_space(prog[i])) {
    i++;
  }

  if (i >= length) {
    ctx->token.type = ADOM_TOK_EOF;
    return 0;
  }

  ctx->token.pos = i;
  c  = prog[i];
  c2 = prog[i+1];

  if (adom__match(c, '-') && adom__match(c2, '-') && adom__match(prog[i+2], '-')) {
    unsigned int* ptr;
    int len = 0;
    int start = i;

    i += 3;
    ptr = &(prog[i]);

    while (1) {
      if (i >= length) {
        adom__print_error(ctx, "Unterminated js context", start);
        return 0;
      }
      if (adom__match(prog[i], '-') && adom__match(prog[i+1], '-') && adom__match(prog[i+2], '-')) {
        i += 3;
        break;
      }
      len++;
      i++;
    }
    ctx->token.type = ADOM_TOK_JS;
    ctx->token.value.ident.data = ptr;
    ctx->token.value.ident.len = len;
    goto done;
  }

  if (adom__match(c, '<') && adom__match(c2, '=')) {
    ctx->token.type = ADOM_TOK_LEQ;
    i+=2;
    goto done;
  }

  if (adom__match(c, '>') && adom__match(c2, '=')) {
    ctx->token.type = ADOM_TOK_GEQ;
    i+=2;
    goto done;
  }

  if (adom__match(c, '!') && adom__match(c2, '=')) {
    ctx->token.type = ADOM_TOK_NEQ;
    i+=2;
    goto done;
  }

  if (adom__match(c, '=') && adom__match(c2, '=')) {
    ctx->token.type = ADOM_TOK_ISEQ;
    i+=2;
    goto done;
  }

  if (adom__match(c, '|') && adom__match(c2, '|')) {
    ctx->token.type = ADOM_TOK_OR;
    i+=2;
    goto done;
  }

  if (adom__match(c, '&') && adom__match(c2, '&')) {
    ctx->token.type = ADOM_TOK_AND;
    i+=2;
    goto done;
  }
  
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
          i++;
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
    goto begin;
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
    goto begin;
  }

  if (adom__is_num(c)) {
    unsigned int* ptr = &(prog[i]);
    int len = 0;
    int d = 0;
    float fres;
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
    fres = adom__parse_num(ptr);
    ctx->token.type = ADOM_TOK_FLOAT;
    ctx->token.value.num = fres;
    goto done;
  }

  if (adom__match(c, '-') && adom__is_num(c2)) {
    int len = 0;
    float fres;
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
    fres = adom__parse_num(ptr);
    ctx->token.type = ADOM_TOK_FLOAT;
    ctx->token.value.num = fres * -1;
    goto done;
  }

  if ((symbol = adom__is_symbol(c)) != -1) {
    ctx->token.type = symbol;
    i++;
    goto done;
  }

  {
    int len = 0;
    unsigned int* ptr = &(prog[i]);

    while (
      adom__is_alpha(prog[i])   ||
      adom__is_num(prog[i])     ||
      adom__match(prog[i], '_') ||
      adom__match(prog[i], '-') ||
      adom__match(prog[i], ':')
    ) {
      len++;
      i++;
    }

    kidx = adom__is_keyword(ptr, len);
    pidx = adom__is_pipeable(ptr, len);

    if (kidx > -1) {
      ctx->token.type = (adom__token_type)kidx;
      ctx->token.value.sym = (char)kidx;
    } else if (pidx > -1) {
      ctx->token.type = ADOM_TOK_PIPEABLE;
      ctx->token.value.sym = (char)pidx;
    } else if (adom__match_str(ptr, len, "true")) {
      ctx->token.type = ADOM_TOK_BOOL;
      ctx->token.value.sym = (char)1;
    } else if (adom__match_str(ptr, len, "false")) {
      ctx->token.type = ADOM_TOK_BOOL;
      ctx->token.value.sym = (char)0;
    } else if (adom__match_str(ptr, len, "null")) {
      ctx->token.type = ADOM_TOK_NULL;
    } else {
      ctx->token.type = ADOM_TOK_IDENTIFIER;
      ctx->token.value.ident.data = ptr;
      ctx->token.value.ident.len = len;
    }
    goto done;
  }
  return 0;
done:
  ctx->cursor = i;
  return 1;
}


/*  parser */
int _adom__expect(adom__context *ctx, adom__token_type type);
int _adom__parse_atom(adom__context *ctx);
int _adom__parse_expr(adom__context *ctx, int minprec);
int _adom__parse_tag(adom__context *ctx);
int _adom__parse_access(adom__context *ctx);
int _adom__parse_conditional(adom__context *ctx);
int _adom__parse_loop(adom__context *ctx);
int _adom__parse_taglist(adom__context *ctx);
int _adom__parse_file(adom__context *ctx, int tag);

#define adom__handle_err(ctx) if (ctx->error) return 0;
#define adom__expect(ctx, type) if (!_adom__expect(ctx, type)) return 0;
#define adom__parse_atom(ctx) if (!_adom__parse_atom(ctx)) return 0;
#define adom__parse_expr(ctx, p) if (!_adom__parse_expr(ctx, p)) return 0;
#define adom__parse_tag(ctx) if (!_adom__parse_tag(ctx)) return 0;
#define adom__parse_access(ctx) if (!_adom__parse_access(ctx)) return 0;
#define adom__parse_conditional(ctx) if (!_adom__parse_conditional(ctx)) return 0;
#define adom__parse_loop(ctx) if (!_adom__parse_loop(ctx)) return 0;
#define adom__parse_taglist(ctx) if (!_adom__parse_taglist(ctx)) return 0;
#define adom__parse_file(ctx, t) if (!_adom__parse_file(ctx, t)) return 0;

int adom__peek(adom__context *ctx, adom__token_type type) {
  if (ctx->token.type == type) {
    return 1;
  }
  return 0;
}

int adom__accept(adom__context *ctx, adom__token_type type) {
  if (ctx->token.type == type) {
    adom__next(ctx);
    return 1;
  }
  return 0;
}

int _adom__expect(adom__context *ctx, adom__token_type type) {
  if (ctx->token.type == type) {
    adom__next(ctx);
    return 1;
  }
  adom__print_error(ctx, "Unexpected token", ctx->token.pos);
  return 0;
}

int _adom__parse_access(adom__context *ctx) {
  adom__handle_err(ctx);
  if (adom__accept(ctx, ADOM_TOK_LBRACK)) {
    adom__parse_expr(ctx, 0);
    adom__expect(ctx, ADOM_TOK_RBRACK);
    adom__parse_access(ctx);
  } else if (adom__accept(ctx, ADOM_TOK_DOT)) {
    adom__expect(ctx, ADOM_TOK_IDENTIFIER);
    adom__parse_access(ctx);
  }
  return 1;
}

int _adom__parse_atom(adom__context *ctx) {
  adom__handle_err(ctx);
  if (adom__accept(ctx, ADOM_TOK_NOT)) {
    adom__parse_atom(ctx);
    return 1;
  }
  if (
      adom__peek(ctx, ADOM_TOK_FLOAT) ||
      adom__peek(ctx, ADOM_TOK_BOOL) ||
      adom__peek(ctx, ADOM_TOK_NULL)
    ) {
    adom__next(ctx);
    return 1;
  }
  if (adom__peek(ctx, ADOM_TOK_IDENTIFIER)) {
    adom__next(ctx);
    adom__parse_access(ctx);
    return 1;
  }
  if (adom__peek(ctx, ADOM_TOK_STRING)) {
    adom__next(ctx);
    return 1;
  }
  if (adom__accept(ctx, ADOM_TOK_LPAREN)) {
    adom__parse_expr(ctx, 0);
    adom__print_token(ctx);
    adom__expect(ctx, ADOM_TOK_RPAREN);
    adom__parse_access(ctx);
    return 1;
  }
  if (adom__peek(ctx, ADOM_TOK_LBRACE)) {
    adom__next(ctx);
    while (1) {
      if (adom__accept(ctx, ADOM_TOK_STRING) ||
          adom__accept(ctx, ADOM_TOK_IDENTIFIER)) {
        adom__expect(ctx, ADOM_TOK_COLON);
        adom__parse_expr(ctx, 0);
        if (!adom__accept(ctx, ADOM_TOK_COMMA)) {
          break;
        }
        adom__print_token(ctx);
      } else {
        break;
      }
    }
    adom__expect(ctx, ADOM_TOK_RBRACE);
    return 1;
  }
  if (adom__peek(ctx, ADOM_TOK_LBRACK)) {
    adom__next(ctx);
    while (1) {
      if (adom__peek(ctx, ADOM_TOK_RBRACK)) {
        break;
      }
      adom__parse_expr(ctx, 0);
      if (!adom__accept(ctx, ADOM_TOK_COMMA)) {
        break;
      }
    }
    adom__expect(ctx, ADOM_TOK_RBRACK);
    return 1;
  }
  if (adom__peek(ctx, ADOM_TOK_FLOAT)) {
    adom__next(ctx);
    return 1;
  }
  adom__print_error(ctx, "Unexpected", ctx->token.pos);
  return 0;
}

int adom__get_prec(adom__context *ctx) {
  switch (ctx->token.type) {
    case ADOM_TOK_OR: return 1;
    case ADOM_TOK_AND: return 1;
    case ADOM_TOK_EQ: return 2;
    case ADOM_TOK_NEQ: return 2;
    case ADOM_TOK_LEQ: return 2;
    case ADOM_TOK_GEQ: return 2;
    case ADOM_TOK_LT: return 3;
    case ADOM_TOK_GT: return 3;
    case ADOM_TOK_PIPE: return 4;
    case ADOM_TOK_PLUS: return 5;
    case ADOM_TOK_MINUS: return 5;
    case ADOM_TOK_MULT: return 6;
    case ADOM_TOK_DIV: return 6;
    case ADOM_TOK_MOD: return 6;
    default: return -1;
  }
}

int _adom__parse_expr(adom__context *ctx, int min) {
  adom__handle_err(ctx);
  adom__parse_atom(ctx);
  while (1) {
    int prec = adom__get_prec(ctx);
    if (prec < min) {
      break;
    }
    if (adom__accept(ctx, ADOM_TOK_PIPE)) {
      int i, args, pipe = (int)ctx->token.value.sym;
      adom__expect(ctx, ADOM_TOK_PIPEABLE);
      args = adom__pipe_args[pipe];
      for (i = 0; i < args; i++) {
        adom__parse_expr(ctx, prec + 1);
      }
    } else {
      adom__next(ctx);
      adom__parse_expr(ctx, prec + 1);
    }
  }
  if (min < 1 && adom__peek(ctx, ADOM_TOK_QMARK)) {
    adom__next(ctx);
    adom__parse_expr(ctx, 0);
    adom__expect(ctx, ADOM_TOK_COLON);
    adom__parse_expr(ctx, 0);
  }
  return 1;
}

int _adom__parse_conditional(adom__context *ctx) {
  adom__handle_err(ctx);
  adom__expect(ctx, ADOM_TOK_IF);
  adom__expect(ctx, ADOM_TOK_LPAREN);
  adom__parse_expr(ctx, 0);
  adom__expect(ctx, ADOM_TOK_RPAREN);
  adom__expect(ctx, ADOM_TOK_LBRACK);
  adom__parse_taglist(ctx);
  adom__expect(ctx, ADOM_TOK_RBRACK);
  return 1;
}

int _adom__parse_loop(adom__context *ctx) {
  adom__handle_err(ctx);
  adom__expect(ctx, ADOM_TOK_EACH);
  adom__expect(ctx, ADOM_TOK_LPAREN);
  adom__expect(ctx, ADOM_TOK_IDENTIFIER);
  if (adom__accept(ctx, ADOM_TOK_COMMA)) {
    adom__expect(ctx, ADOM_TOK_IDENTIFIER);
  }
  adom__expect(ctx, ADOM_TOK_IN);
  adom__parse_expr(ctx, 0);
  adom__expect(ctx, ADOM_TOK_RPAREN);
  adom__expect(ctx, ADOM_TOK_LBRACK);
  adom__parse_taglist(ctx);
  adom__expect(ctx, ADOM_TOK_RBRACK);
  return 1;
}

int _adom__parse_taglist(adom__context *ctx) {
  while (1) {
    if (adom__peek(ctx, ADOM_TOK_IDENTIFIER)) {
      adom__parse_tag(ctx);
    } else if (adom__peek(ctx, ADOM_TOK_EACH)) {
      adom__parse_loop(ctx);
    } else if (adom__peek(ctx, ADOM_TOK_IF)) {
      adom__parse_conditional(ctx);
    } else {
      break;
    }
  }
  return 1;
}

int _adom__parse_tag(adom__context *ctx) {
  /* todo: make sure valid html tag or custom tag */
  adom__handle_err(ctx);
  adom__expect(ctx, ADOM_TOK_IDENTIFIER);
  while (1) {
    if (!adom__accept(ctx, ADOM_TOK_DOT)) {
      break;
    }
    adom__expect(ctx, ADOM_TOK_IDENTIFIER);
  }
  while (1) {
    if (!adom__accept(ctx, ADOM_TOK_IDENTIFIER)) {
      break;
    }
    if (adom__accept(ctx, ADOM_TOK_EQ)) {
      if (adom__accept(ctx, ADOM_TOK_LBRACE)) {
        adom__parse_expr(ctx, 0);
        adom__expect(ctx, ADOM_TOK_RBRACE);
      } else {
        adom__expect(ctx, ADOM_TOK_STRING);
      }
    } else {
      /*  attr=true */
    }
  }
  if (adom__accept(ctx, ADOM_TOK_STRING)) {
    return 1;
  }

  adom__expect(ctx, ADOM_TOK_LBRACK);
  adom__parse_taglist(ctx);
  adom__expect(ctx, ADOM_TOK_RBRACK);
  return 1;
}

int _adom__parse_file(adom__context *ctx, int tag) {
  adom__handle_err(ctx);
  while (1) {
    if (tag == 0 && adom__accept(ctx, ADOM_TOK_IMPORT)) {
      adom__expect(ctx, ADOM_TOK_STRING);
    } else if (adom__accept(ctx, ADOM_TOK_LET)) {
      adom__expect(ctx, ADOM_TOK_IDENTIFIER);
      adom__expect(ctx, ADOM_TOK_EQ);
      adom__parse_expr(ctx, 0);
    } else if (tag == 0 && adom__accept(ctx, ADOM_TOK_TAG)) {
      adom__expect(ctx, ADOM_TOK_IDENTIFIER);
      adom__expect(ctx, ADOM_TOK_LBRACK);
      adom__parse_file(ctx, 1);
      adom__expect(ctx, ADOM_TOK_RBRACK);
    } else if (adom__accept(ctx, ADOM_TOK_JS)) {
      /* print */
    } else if (adom__peek(ctx, ADOM_TOK_IDENTIFIER)) {
      adom__parse_tag(ctx);
    } else if (adom__peek(ctx, ADOM_TOK_EACH)) {
      adom__parse_loop(ctx);
    } else if (adom__peek(ctx, ADOM_TOK_IF)) {
      adom__parse_conditional(ctx);
    } else if (adom__accept(ctx, ADOM_TOK_EOF)) {
      break;
    } else if (tag == 0) {
      adom__print_error(ctx, "Unexpected token", ctx->token.pos);
      return 0;
    } else {
      break;
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
  
  adom__next(&adom);
  _adom__parse_file(&adom, 0);

  return out;
}

#include <time.h>

int main(int argc, char *argv[]) {
  clock_t start_time, end_time;
  double elapsed_time;
  char *html;

  if (argc < 2) {
    fprintf(stderr, "Usage: %s FILENAME\n", argv[0]);
    return 1;
  }

  start_time = clock();
  html = adom_compile_to_html(argv[1], NULL, 0);
  end_time = clock();
  /* free(html); */
  elapsed_time = (double)(end_time - start_time) / CLOCKS_PER_SEC * 1000000;
  printf("compiled in: %.2f microseconds\n", elapsed_time);

  return 0;
}

