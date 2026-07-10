app.js: builds the app(config)
* require() -> stores a func var
* app.get/post/x is (path, operation)
* (req,res) => is an arrow func, no name func and is used as a callback func, not run yet, only when called

index.js: turns on the app (entry/start)
* app.listen uses () => b/c callback func
* console.log(`words and {var}`) backticks to include var

schema.sql: 
* ON DELETE SET NULL, used for setting created by to NULL
* ON DELETE SET CASCADE, deleting a circuit should delete all exercise connections