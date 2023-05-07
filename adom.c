#include <stdio.h>
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

void *adom__alloc(size_t size) {
  void *buf = malloc(size);
  if (!buf) {
    fprintf(stderr, "Fatal: out of memory\n");
    exit(0);
  }
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

char *adom_compile_to_html(const char* file, const char* data, int dlen) {
  int i, j, length;
  char *out;
  unsigned int *program;

  program = adom__read_file_utf8(file, &length);
  if (!program) return NULL;

  for (i = 0; i < length; i++) {
    char point[4];
    int len = adom__print_utf8(program[i], point);
    for (j = 0; j < len; j++) putchar(point[j]);
  }

  free(program);

  return out;
}

int main(int argc, char *argv[]) {
  char *html;

  if (argc < 2) {
    fprintf(stderr, "Usage: %s FILENAME\n", argv[0]);
    return 1;
  }

  html = adom_compile_to_html(argv[1], NULL, 0);

  return 0;
}

