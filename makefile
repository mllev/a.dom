build:
	gcc adom.c -O3 -Wall -ansi -pedantic -std=c89 -lm -o adom 

run:
	gcc adom.c -O3 -Wall -ansi -pedantic -std=c89 -lm -o adom && ./adom ../a.dom-examples/beat-machine/index.adom

debug:
	gcc adom.c -g -O0 -Wall -ansi -pedantic -std=c89 -lm -o adom && gdb adom

clean:
	rm -f adom
	
