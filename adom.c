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
struct adom__context {
  struct {
    unsigned int *content;
    int len;
  } src;
  int cursor;
};

unsigned int adom__get_code_point(FILE *file) {
  unsigned int p = 0;
  int c = fgetc(file);

  if (c == EOF) {
    return 0;
  } else if ((c & 0x80) == 0) {
    return c;
  } else if ((c & 0xE0) == 0xC0) {
    p = c & 0x1F;
    p = (p << 6) | (fgetc(file) & 0x3F);
  } else if ((c & 0xF0) == 0xE0) {
    p = c & 0x0F;
    p = (p << 6) | (fgetc(file) & 0x3F);
    p = (p << 6) | (fgetc(file) & 0x3F);
  } else if ((c & 0xF8) == 0xF0) {
    p = c & 0x07;
    p = (p << 6) | (fgetc(file) & 0x3F);
    p = (p << 6) | (fgetc(file) & 0x3F);
    p = (p << 6) | (fgetc(file) & 0x3F);
  }

  return p;
}

int adom__print_utf8(unsigned int p, char* out) {
  if (p < 0x80) {
    out[0] = p;
    return 1;
  } else if (p < 0x800) {
    out[0] = (p >> 6) | 0xC0;
    out[1] = (p & 0x3F) | 0x80;
    return 2;
  } else if (p < 0x10000) {
    out[0] = (p >> 12) | 0xE0;
    out[1] = ((p >> 6) & 0x3F) | 0x80;
    out[2] = (p & 0x3F) | 0x80;
    return 3;
  } else {
    out[0] = (p >> 18) | 0xF0;
    out[1] = ((p >> 12) & 0x3F) | 0x80;
    out[2] = ((p >> 6) & 0x3F) | 0x80;
    out[3] = (p & 0x3F) | 0x80;
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

const char *adom__keywords[] = {
  "tag",
  "each",
  "if",
  "in",
  "else",
  "import",
  "yield",
  "on",
  "export",
  "file",
  "let", /* remove maybe */
  "local",
  "global",
  "root",
  "nosync"
};

const char* adom__is_keyword(const unsigned int *ident, int length) {
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
      return adom__keywords[i];
    }
  }
  return NULL;
}

#define _adom__is_ascii(x) (((x)&0x80)==0)
#define _adom__is_num(x) (_adom__is_ascii(x) && (char)x >= '0' && (char)x <= '9')
#define _adom__is_space(x) (_adom__is_ascii(x) && ((char)x == ' ' || (char)x == '\t' || (char)x == '\n' || (char)x == '\r'))
#define _adom__match(x, c) (_adom__is_ascii(x) && ((char)(x) == (c)))

int adom__is_symbol(unsigned int c) {
  int i;
  const char symlist[] = {
    '.', '=', '[', ']', ';', '{', '}', '(', ')', ':',
    ',', '>', '<', '?', '|', '+', '/', '-', '*', '%',
    '!'
  };
  for (i = 0; i < 21; i++) {
    if (_adom__match(c, symlist[i])) {
      return 1;
    }
  }
  return 0;
}

int adom__parse_num(unsigned int *ptr, float *fres, int *ires) {
  float num = 0.0;
  int d = 0;
  float div = 10.0;
  while (_adom__is_num(*ptr) || (_adom__match(*ptr, '.') && !d)) {
    if (_adom__match(*ptr, '.')) d = 1;
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

char *adom_compile_to_html(const char* file, const char* data, int dlen) {
  int i, j, length;
  char *out;
  unsigned int *prog;

  prog = adom__read_file_utf8(file, &length);

  if (!prog) return NULL;

  for (i = 0; i < length; i++) {
    unsigned int c, c2;
    const char *keyword;

    /* skip white space */
    while (_adom__is_space(prog[i])) {
      i++;
    }

    if (i >= length) {
      break;
    }

    c  = prog[i];
    c2 = prog[i+1];

    if (_adom__match(c, '"') || _adom__match(c, '\'') || _adom__match(c, '`')) {
      unsigned int* ptr;
      int len = 0;
      char del = (char)c;
      int err = 0;

      ptr = &(prog[++i]);

      while (1) {
        if (i >= length) {
          printf("Unterminated string\n");
          err = 1;
          break;
        }
        if (_adom__match(prog[i], del)) {
          if (!_adom__match(prog[i-1], '\\')) {
            break;
          }
        }
        /* todo: handle escape characters */
        len++;
        i++;
      }
      if (err) {
        break;
      }
      printf("STRING: ");
      adom__print_string(ptr, len);
      printf("\n");
      continue;
    }

    if (_adom__match(c, '/') && _adom__match(c2, '/')) {
      while (1) {
        if (i >= length || _adom__match(prog[i], '\n')) {
          break;
        }
        i++;
      }
      continue;
    }

    if (_adom__match(c, '/') && _adom__match(c2, '*')) {
      while (1) {
        if (i >= length) break;
        if (_adom__match(prog[i], '*') && _adom__match(prog[i+1], '/')) {
          break;
        }
        i++;
      }
      continue;
    }

    if (_adom__is_num(c)) {
      unsigned int* ptr = &(prog[i]);
      int len = 0;
      int d = 0;
      float fres;
      int ires;
      while (1) {
        if (i >= length) break;
        if (_adom__match(prog[i], '.')) {
          if (d == 1) break;
          d = 1;
        } else if (!_adom__is_num(prog[i])) {
          break;
        }
        i++;
        len++;
      }
      printf("NUMBER: ");
      adom__print_string(ptr, len);
      printf("\n");
      if (adom__parse_num(ptr, &fres, &ires)) {
        printf("PARSED NUMBER: %f\n", fres);
      } else {
        printf("PARSED NUMBER: %d\n", ires);
      }
      continue;
    }

    if (_adom__match(c, '-') && _adom__is_num(c2)) {
      int len = 0;
      float fres;
      int ires;
      unsigned int* ptr = &(prog[i++]);
      int d = 0;
      while (1) {
        if (i >= length) break;
        if (_adom__match(prog[i], '.')) {
          if (d == 1) break;
          d = 1;
        } else if (!_adom__is_num(prog[i])) {
          break;
        }
        i++;
        len++;
      }
      printf("NUMBER: ");
      adom__print_string(ptr, len);
      printf("\n");
      ptr++;
      if (adom__parse_num(ptr, &fres, &ires)) {
        printf("PARSED NUMBER: %f\n", fres * -1);
      } else {
        printf("PARSED NUMBER: %d\n", ires * -1);
      }
      continue;
    }

    if (adom__is_symbol(c)) {
      printf("SYMBOL: %c\n", (char)c);
      continue;
    }

    {
      int len = 0;
      unsigned int* ptr = &(prog[i]);

      while (!_adom__is_space(prog[i]) && !adom__is_symbol(prog[i])) {
        len++;
        i++;
      }

      keyword = adom__is_keyword(ptr, len);

      if (keyword) {
        printf("KEYWORD: %s\n", keyword);
      } else {
        printf("IDENTIFIER: ");
        adom__print_string(ptr, len);
        printf("\n");
      }
    }
  }

  free(prog);

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

