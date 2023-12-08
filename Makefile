.DEFAULT_GOAL := build

.PHONY: build


build:
	hugo -d docs
