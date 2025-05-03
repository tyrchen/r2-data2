use crate::error::AppError;
use crate::handlers::FullSchema;
use rig::OneOrMany;
use rig::completion::Chat;
use rig::message::Message;
use rig::message::{AssistantContent, UserContent};
use rig::providers::openai as rig_openai;
use tracing::{error, info, instrument};

// Placeholder for the AI query generation logic
#[instrument(skip(openai_client, schema), fields(db_name = %db_name))]
pub async fn generate_sql_query(
    openai_client: &rig_openai::Client,
    db_name: &str,
    schema: &FullSchema, // Or maybe just DatabaseSchema?
    prompt: &str,
) -> Result<String, AppError> {
    info!("Generating SQL query using AI for database: {}", db_name);

    // TODO: 1. Format the schema into a string (e.g., Markdown)
    let schema_string = format_schema_for_prompt(schema, db_name)?;

    // Construct the prompt using rig::completion::Prompt
    // System prompt provides context and instructions
    let system_prompt = format!(
        r#"You are an expert SQL assistant. You are connected to a database named '{}'.
        Given the following database schema (in Markdown format), write a single, valid SQL query
        that precisely answers the user's request. Only output the pure SQL query, no code fence, no backticks, no additional explanation or text.
        "\n\nDatabase Schema:\n```markdown\n{}\n```"#,
        db_name, schema_string
    );

    // User prompt contains the specific request
    let user_prompt = prompt.to_string();

    // Define the model to use (e.g., gpt-4o)
    let model = "gpt-4o";
    info!("Prompting model '{}'", model);

    // Build the agent and send the prompt
    let agent = openai_client.agent(model).build();

    // Construct messages for the chat API
    let messages = vec![Message::Assistant {
        content: OneOrMany::one(AssistantContent::Text(system_prompt.into())),
    }];

    let prompt = Message::User {
        content: OneOrMany::one(UserContent::Text(user_prompt.into())),
    };

    match agent.chat(prompt, messages).await {
        Ok(response) => {
            info!("Successfully received response from AI model.");
            if response.is_empty() {
                error!("AI returned an empty response.");
                return Err(AppError::AiError(
                    "AI returned an empty response.".to_string(),
                ));
            }

            info!("Generated SQL query: {}", response);
            Ok(response)
        }
        Err(e) => {
            error!("Error calling OpenAI API: {}", e);
            // Convert rig::Error into AppError::AiError
            Err(AppError::AiError(format!(
                "Failed to generate query: {}",
                e
            )))
        }
    }
}

// Placeholder for schema formatting logic
fn format_schema_for_prompt(schema: &FullSchema, db_name: &str) -> Result<String, AppError> {
    // Find the specific database schema
    let db_schema = schema
        .databases
        .iter()
        .find(|db| db.name == db_name)
        .ok_or_else(|| AppError::NotFound(format!("Schema not found for database: {}", db_name)))?;

    // Simple Markdown formatting (can be enhanced)
    let mut markdown = format!("# Database: {}\n\n", db_schema.name);
    for table in &db_schema.tables {
        markdown.push_str(&format!("## Table: {}\n", table.table_name));
        markdown.push_str("| Column | Type | Nullable | PK | FK |\n");
        markdown.push_str("|---|---|---|---|---|\n");
        for col in &table.columns {
            markdown.push_str(&format!(
                "| {} | {:?} | {} | {} | {} |\n",
                col.name,
                col.data_type,
                if col.is_nullable { "YES" } else { "NO" },
                if col.is_pk { "YES" } else { "NO" },
                col.fk_table.as_ref().map_or("NO".to_string(), |t| format!(
                    "-> {}.{}",
                    t,
                    col.fk_column.as_deref().unwrap_or("?")
                ))
            ));
        }
        markdown.push('\n');
    }

    Ok(markdown)
}

#[cfg(test)]
mod tests {
    use super::*;
    // Import necessary structs directly from db and handlers
    use crate::db::{ColumnInfo, ColumnType, TableSchema}; // Import directly from db
    use crate::handlers::{DatabaseSchema, FullSchema};
    use insta::assert_snapshot;

    #[test]
    fn test_format_schema_simple() {
        // Arrange: Create mock schema data
        let db_schema = DatabaseSchema {
            name: "test_db".to_string(),
            db_type: "postgresql".to_string(),
            tables: vec![
                TableSchema {
                    table_name: "users".to_string(),
                    columns: vec![
                        ColumnInfo {
                            name: "id".to_string(),
                            data_type: ColumnType::Other("integer".to_string()), // Wrap type
                            is_nullable: false,
                            is_pk: true,
                            is_unique: false,
                            fk_table: None,
                            fk_column: None,
                        },
                        ColumnInfo {
                            name: "username".to_string(),
                            data_type: ColumnType::Other("text".to_string()), // Wrap type
                            is_nullable: false,
                            is_pk: false,
                            is_unique: true,
                            fk_table: None,
                            fk_column: None,
                        },
                    ],
                },
                TableSchema {
                    table_name: "posts".to_string(),
                    columns: vec![
                        ColumnInfo {
                            name: "post_id".to_string(),
                            data_type: ColumnType::Other("integer".to_string()), // Wrap type
                            is_nullable: false,
                            is_pk: true,
                            is_unique: false,
                            fk_table: None,
                            fk_column: None,
                        },
                        ColumnInfo {
                            name: "user_id".to_string(),
                            data_type: ColumnType::Other("integer".to_string()), // Wrap type
                            is_nullable: false,
                            is_pk: false,
                            is_unique: false,
                            fk_table: Some("users".to_string()),
                            fk_column: Some("id".to_string()),
                        },
                        ColumnInfo {
                            name: "content".to_string(),
                            data_type: ColumnType::Other("text".to_string()), // Wrap type
                            is_nullable: true,
                            is_pk: false,
                            is_unique: false,
                            fk_table: None,
                            fk_column: None,
                        },
                    ],
                },
            ],
        };
        let full_schema = FullSchema {
            databases: vec![db_schema],
        };

        // Act: Call the function
        let result = format_schema_for_prompt(&full_schema, "test_db");

        // Assert: Check if successful and compare with snapshot
        assert!(result.is_ok());
        assert_snapshot!(result.unwrap());
    }

    #[test]
    fn test_format_schema_db_not_found() {
        // Arrange: Empty schema
        let full_schema = FullSchema { databases: vec![] };

        // Act: Call the function with a non-existent db name
        let result = format_schema_for_prompt(&full_schema, "non_existent_db");

        // Assert: Check for NotFound error
        assert!(result.is_err());
        match result.err().unwrap() {
            AppError::NotFound(msg) => {
                assert!(msg.contains("Schema not found for database: non_existent_db"));
            }
            _ => panic!("Expected NotFound error"),
        }
    }
}
