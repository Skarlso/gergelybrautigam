.DEFAULT_GOAL := build

.PHONY: build serve


build:
	hugo --minify --cleanDestinationDir -d docs

serve:
	hugo server
