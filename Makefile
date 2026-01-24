BINARY_NAME=gopherdrop.exe

all: build

build:
	go build -o $(BINARY_NAME) .

run: build
	./$(BINARY_NAME)

clean:
	go clean
	@if exist $(BINARY_NAME) del $(BINARY_NAME)

.PHONY: all build run clean