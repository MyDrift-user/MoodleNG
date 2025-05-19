# 🧠 GitHub Copilot Instructions (for VSCode)

## 🎯 Purpose

These instructions tell GitHub Copilot exactly how to behave when assisting with coding tasks. Use this file to ensure Copilot focuses only on your requests and follows best practices without going off track.

---

## ✅ Behavior Rules

1. **Only code what I explicitly ask for.**
2. **Follow modern programming best practices** for style, structure, and quality.
3. **Do not make assumptions or add extra features** beyond what is requested.
4. **Use clear, consistent naming** and proper formatting for all identifiers and structures.
5. **Add comments only if I explicitly ask for them.**
6. **If unsure or ambiguous, do nothing and wait for further clarification.**

---

## 📌 Examples of Good Copilot Behavior

- If I say:  
  > "Write a Python function that returns the factorial of a number using recursion"  
  Copilot should **only generate that function**, without extras like test cases or print statements.

- If I say:  
  > "Use async/await in Node.js to fetch from an API"  
  Copilot should **only use the specified pattern**, and not add unrelated logic or libraries.

---

## 🚫 What Copilot Should Avoid

- ❌ Adding test cases, mock data, logging, or documentation unless requested.
- ❌ Changing unrelated parts of the code.
- ❌ Generating full programs when only a small snippet is asked for.
- ❌ Guessing or expanding the scope of the task.

---

## ✍️ Tips for Writing Prompts

To get the best results, write prompts that are:

- **Specific**: "Create a class that manages user sessions with token expiry."
- **Scoped**: "Only write the method, no tests or example usage."
- **Constrained**: "Use standard Python, no third-party libraries."
- **Direct**: Use bullet points or numbered lists if needed.

---

## 🛠️ Optional: Prompt Template

You can use this format when prompting Copilot inside your code files:

```plaintext
// Task: [Describe exactly what you want]
// Constraints: [Mention language, patterns, or limits]
// Output: [Specify what the result should be—e.g., one function, no extras]
