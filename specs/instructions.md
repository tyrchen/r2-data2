# Instructions

VAN: please read the design doc @0001-design.md and initialize the memory bank under ./.cursor/memory

Enter PLAN mode: I've manually finished Task B.1, B.2. Now please plan for the project based on @0001-design.md and update memory bank accordingly.

IMPLEMENT: I've refactored the code and provided an initial code layout. Please update your memory based on that and start next task

Thanks. Please always run `cargo clippy` and `cargo test` before you wrap up and fix any issues from those commands. Now implement next

You need to call `pin()` before using it for papaya::HashMap. Now I've fixed it and refactored the db code extensively. Please update your memory and follow my code patterns. Please update @tasks.md to reflect current status and continue with next task

I've fixed the issue. Please update your memory. You should follow the attached example in future on how to use papaya::HashMap. Now please make sure is_pk, is_unique, fk_table, fk_column is implemented.

I've manuage fixed the issue and refactored the code. When there's a new feature, do not put too much code in handler, try to see if it makes send to work on the db layer, and if need to add a trait. Now please update task status and go to next task.

I've manually moved those docs to ./.cursor/memory. based on your study, update @tasks.md

Enter implement mode, pick up next task

For the catalog browser, please use shadcn sidebar and put search filter and refresh into it. Then build a custom tree yourself like the attached image


Now it works! There're several UI improvements to be made:
1. Toolbox sidebar: remove the tooggle button. And make the tool button group take whole height. The toolbox sidebar should not be resizeable. Make the tooltip more elegant.
2. Catalog side bar: should the whole thing to be wrapped by a shadcn sidebar (already installed). And also add proper margin to make the view more element. The refresh button shouldn't spin unless it is refreshing, make sure the state is correct.
3. main query panel: add proper padding/margin to make the view more elegant. Remove "No query history yet", remove "Result viewer".

Please review and see what else should be implemented. Also update files under ./.cursor/memory accordingly

Great! Now once we sanitized the query, before wrap it to CTE, first run  `EXPLAIN (FORMAT JSON) {original query}` to get the plan, then wrap with CTE and execute the actual query. The plan data should be consumed by UI.

This is not good. I've reverted the code. Let's skip this task and go the next one.

Two fixes: If database can't be connected just skip it. Also query editor, add an input before the execute button, default to 500 rows, and submit it to backend. Backend should add a limit with that value with CTE.

All chart related UI should be under chart tab

Show chart button is not needed as now chart is under a tab. Also the dropdown of chart type could be put under chart configuration. One more thing, chart configuration should be put in the left. And make "Chart configuration" as bold title.

Looks like the checkbox state or style is not correct. And also chart is not being show, no error message in UI. Please help to fix.

limit should be unwrap default to 500, and if it is larger than 5000, change it to 5000. Then it should be passed into sanitize_query and inside sanitize_query, if user already provided limit, and it is < passed limit , use that, otherwise change to the passed limit.

ENTER PLAN mode: Now let's plan for building an AI feature - use could hit CMD/CTRL+K or click a button (before execute query) to open a non-intruitive popup window to provide a prompt on what they want to query, then it will be send to a backend endpoint /api/gen-query along with database to get a AI generated SQL. The endpoint will have a prompt template which provide all the schema data of the database and then send to openai gpt4o model, to generate the SQL query. The returned query will replace the content in the sql editor. And user can tune it or run it later on.

For backend let's use rig-core (already added to the Cargo.toml). Below is a simple usage. Please update plan accordinlgy
```rust
use rig::{completion::Prompt, providers::openai};
#[tokio::main]
async fn main() {
    // Create OpenAI client and model
    // This requires the `OPENAI_API_KEY` environment variable to be set.
    let openai_client = openai::Client::from_env();

    let gpt4 = openai_client.agent("gpt-4").build();

    // Prompt the model and print its response
    let response = gpt4
        .prompt("Who are you?")
        .await
        .expect("Failed to prompt GPT-4");

    println!("GPT-4: {response}");
}
```

Now enter IMPLEMENT mode and start next task

Got this warning. Please do a deep think and analysis on the root cause and fix it
```js
chunk-KPD4VVXB.js?v=7fc08d83:521 Warning: Function components cannot be given refs. Attempts to access this ref will fail. Did you mean to use React.forwardRef()?

Check the render method of `Primitive.div.SlotClone`.
    at DialogOverlay (http://localhost:5173/src/components/ui/dialog.tsx:61:3)
    at http://localhost:5173/node_modules/.vite/deps/chunk-L27TEVJV.js?v=7fc08d83:79:13
    at http://localhost:5173/node_modules/.vite/deps/chunk-L27TEVJV.js?v=7fc08d83:56:13
    at http://localhost:5173/node_modules/.vite/deps/chunk-JRCXRKZO.js?v=7fc08d83:43:13
    at http://localhost:5173/node_modules/.vite/deps/chunk-OSJ2CR7Q.js?v=7fc08d83:260:22
    at Presence (http://localhost:5173/node_modules/.vite/deps/chunk-DPDODI5M.js?v=7fc08d83:24:11)
    at Provider (http://localhost:5173/node_modules/.vite/deps/chunk-YWN3V753.js?v=7fc08d83:48:15)
    at DialogPortal (http://localhost:5173/node_modules/.vite/deps/chunk-TBC2FIAX.js?v=7fc08d83:110:11)
    at DialogPortal (http://localhost:5173/src/components/ui/dialog.tsx:41:6)
    at DialogContent (http://localhost:5173/src/components/ui/dialog.tsx:86:3)
    at Provider (http://localhost:5173/node_modules/.vite/deps/chunk-YWN3V753.js?v=7fc08d83:48:15)
    at Dialog (http://localhost:5173/node_modules/.vite/deps/chunk-TBC2FIAX.js?v=7fc08d83:50:5)
    at Dialog (http://localhost:5173/src/components/ui/dialog.tsx:21:6)
    at GenerateQueryModal (http://localhost:5173/src/components/ai/GenerateQueryModal.tsx?t=1746219473987:33:36)
    at DndProvider2 (http://localhost:5173/node_modules/.vite/deps/chunk-N7SF7J5U.js?v=7fc08d83:2176:27)
    at App (http://localhost:5173/src/App.tsx?t=1746221419545:32:36)
```

All UI functionality is ok but just have this warning. Please fix it.

I figured out the issue my self. Need to improve generated dialog code like this:

```tsx
const Dialog = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<typeof DialogPrimitive.Root>
>(({ ...props }, _) => {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
})
Dialog.displayName = "Dialog"
```
