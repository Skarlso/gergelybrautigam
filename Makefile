.DEFAULT_GOAL := build

.PHONY: build serve


build:
	hugo --minify --gc --cleanDestinationDir

serve:
	hugo server
