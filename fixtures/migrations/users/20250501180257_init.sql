-- Add migration script here
CREATE TABLE users(
  id serial PRIMARY KEY,
  name varchar(255) NOT NULL,
  email varchar(255) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL
);

CREATE TABLE repositories(
  id serial PRIMARY KEY,
  name varchar(255) NOT NULL,
  url varchar(255) NOT NULL UNIQUE,
  owner_id integer NOT NULL REFERENCES users(id)
);

CREATE TABLE repository_members(
  id serial PRIMARY KEY,
  repository_id integer NOT NULL REFERENCES repositories(id),
  user_id integer NOT NULL REFERENCES users(id),
  UNIQUE (repository_id, user_id)
);

CREATE VIEW repositories_with_owner AS
SELECT
  r.id,
  r.name,
  r.url,
  json_build_object('id', u.id, 'name', u.name, 'email', u.email) AS owner
FROM
  repositories r
  JOIN users u ON r.owner_id = u.id;

CREATE MATERIALIZED VIEW repositories_with_members AS
SELECT
  r.id,
  r.name,
  r.url,
  json_build_object('id', u.id, 'name', u.name, 'email', u.email) AS owner,
  json_agg(json_build_object('id', mu.id, 'name', mu.name, 'email', mu.email)) AS members
FROM
  repositories r
  JOIN users u ON r.owner_id = u.id
  LEFT JOIN repository_members rm ON r.id = rm.repository_id
  LEFT JOIN users mu ON rm.user_id = mu.id
GROUP BY
  r.id,
  r.name,
  r.url,
  u.id,
  u.name,
  u.email;

INSERT INTO users(name, email, password)
  VALUES ('Alice Johnson', 'alice@example.com', '$argon2id$v=19$m=65536,t=3,p=4$c29tZXNhbHQ$RdescudvJCsgt3ub+b+dWRWJTmaaJObG');

INSERT INTO users(name, email, password)
  VALUES ('Bob Brown', 'bob@example.com', '$argon2id$v=19$m=65536,t=3,p=4$c29tZXNhbHQ$RdescudvJCsgt3ub+b+dWRWJTmaaJObG');

INSERT INTO users(name, email, password)
  VALUES ('Charlie Davis', 'charlie@example.com', '$argon2id$v=19$m=65536,t=3,p=4$c29tZXNhbHQ$RdescudvJCsgt3ub+b+dWRWJTmaaJObG');

INSERT INTO users(name, email, password)
  VALUES ('John Doe', 'john@example.com', '$argon2id$v=19$m=65536,t=3,p=4$c29tZXNhbHQ$RdescudvJCsgt3ub+b+dWRWJTmaaJObG');

INSERT INTO users(name, email, password)
  VALUES ('Jane Smith', 'jane@example.com', '$argon2id$v=19$m=65536,t=3,p=4$c29tZXNhbHQ$RdescudvJCsgt3ub+b+dWRWJTmaaJObG');

INSERT INTO repositories(name, url, owner_id)
  VALUES ('Example Repository', 'https://github.com/alice/example-repo', 1);

INSERT INTO repositories(name, url, owner_id)
  VALUES ('Example Repository 2', 'https://github.com/alice/example-repo-2', 1);

INSERT INTO repositories(name, url, owner_id)
  VALUES ('Another Repository', 'https://github.com/bob/another-repo', 2);

INSERT INTO repositories(name, url, owner_id)
  VALUES ('Private Repository', 'https://github.com/charlie/private-repo', 3);

INSERT INTO repositories(name, url, owner_id)
  VALUES ('Secret Repository', 'https://github.com/charlie/secret-repo', 3);

INSERT INTO repository_members(repository_id, user_id)
  VALUES (1, 2);

INSERT INTO repository_members(repository_id, user_id)
  VALUES (1, 3);

INSERT INTO repository_members(repository_id, user_id)
  VALUES (2, 1);

INSERT INTO repository_members(repository_id, user_id)
  VALUES (2, 3);
