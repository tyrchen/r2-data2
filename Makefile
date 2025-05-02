MIGRATION_FOLDERS := $(wildcard fixtures/migrations/*/)
DBNAMES := $(patsubst %/,%,$(notdir $(MIGRATION_FOLDERS)))

ui-build:
	@cd ui && npm run build

run: ui-build
	@cargo run

build: ui-build
	@cargo build --release

test:
	@cargo nextest run --all-features

release:
	@cargo release tag --execute
	@git cliff -o CHANGELOG.md
	@git commit -a -n -m "Update CHANGELOG.md" || true
	@git push origin master
	@cargo release push --execute

update-submodule:
	@git submodule update --init --recursive --remote

migrate: $(MIGRATION_FOLDERS)
	@echo "All migrations completed"

migrate-add:
ifndef NAME
	$(error DESC is required. Usage: make migrate-add NAME=<migration_name> DESC=<description>)
endif
ifndef DESC
	$(error DESC is required. Usage: make migrate-add NAME=<migration_name> DESC=<description>)
endif
	@mkdir -p fixtures/migrations/$(NAME)
	sqlx migrate add --source fixtures/migrations/$(NAME) $(DESC)
	@echo "Migration $(DESC) added for $(NAME)"

$(MIGRATION_FOLDERS):
	@$(eval DBNAME := $(notdir $(@:/=)))
	@sqlx database reset -y -D postgres://localhost:5432/r2-data-2-$(DBNAME)  --source $@

.PHONY: build test release update-submodule migrate $(MIGRATION_FOLDERS) ui-build run
