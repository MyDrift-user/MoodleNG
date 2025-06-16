# Quiz Testing Guide

This guide will help you test the quiz functionality step by step using the API Explorer.

## Prerequisites

1. Make sure you're logged into a Moodle site with quiz access
2. Have at least one quiz available in your courses
3. Navigate to the API Explorer in the application

## Step-by-Step Testing Process

### Step 1: Get Available Quizzes

1. **Go to API Explorer → Quiz tab**
2. **Select "Get Quizzes by Courses"**
3. **Parameters:**
   - Leave `courseids[]` empty to get quizzes from all enrolled courses
   - OR enter specific course IDs separated by commas (e.g., "1061,1062")
4. **Execute the call**
5. **Expected Result:** List of quizzes with details like:
   - Quiz ID, name, course
   - Time limits, attempts allowed
   - Access restrictions
   - Question count, grading method

### Step 2: Check Quiz Access

1. **Select "Get Quiz Access Information"**
2. **Parameters:**
   - `quizid`: Use a quiz ID from Step 1 (e.g., 11444)
3. **Execute the call**
4. **Expected Result:** Access information including:
   - `canattempt`: true/false
   - `preventaccessreasons`: [] (should be empty if you can attempt)
   - `accessrules`: List of active restrictions
   - `activerulenames`: Active access rule plugins

### Step 3: Check Existing Attempts

1. **Select "Get User Quiz Attempts"**
2. **Parameters:**
   - `quizid`: Same quiz ID from Step 2
   - `status`: "all" (or "finished", "inprogress")
   - `includepreviews`: "0"
3. **Execute the call**
4. **Expected Result:** List of your previous attempts (may be empty)
   - Each attempt shows: id, state, timestart, timefinish, sumgrades

### Step 4: Start a New Quiz Attempt

1. **Select "Start Quiz Attempt"**
2. **Parameters:**
   - `quizid`: Same quiz ID
   - `forcenew`: "0" (or "1" to force new attempt)
   - `preflightdata`: Leave empty (unless quiz requires password)
3. **Execute the call**
4. **Expected Result:** New attempt object with:
   - `attempt.id`: The new attempt ID (save this!)
   - `attempt.state`: "inprogress"
   - `attempt.timestart`: Start timestamp
   - `attempt.uniqueid`: Question usage ID

### Step 5: Get Quiz Questions

1. **Select "Get Quiz Attempt Data"**
2. **Parameters:**
   - `attemptid`: Use the attempt ID from Step 4
   - `page`: "-1" (for all pages) or "0" for first page
   - `preflightdata`: Leave empty
3. **Execute the call**
4. **Expected Result:** Attempt data with questions:
   - `attempt`: Updated attempt info
   - `questions`: Array of question objects with HTML content
   - `nextpage`: Next page number (-1 if last page)

### Step 6: Save Answers (Auto-save)

1. **Select "Save Quiz Attempt"**
2. **Parameters:**
   - `attemptid`: Same attempt ID
   - `data`: JSON string with answers (see format below)
   - `finishattempt`: "0"
   - `timeup`: "0"
3. **Answer Data Format:**
   ```json
   {
     "q{attemptid}:{slot}_:sequencecheck": "1",
     "q{attemptid}:{slot}_sub1_answer": "your answer here",
     "q{attemptid}:{slot}_sub2_answer": "another answer"
   }
   ```
4. **Execute the call**
5. **Expected Result:** Save confirmation

### Step 7: Submit Quiz (Final)

1. **Select "Process Quiz Attempt"**
2. **Parameters:**
   - `attemptid`: Same attempt ID
   - `data`: Same answer format as Step 6
   - `finishattempt`: "1" (this submits the quiz)
   - `timeup`: "0"
3. **Execute the call**
4. **Expected Result:** Submission confirmation

### Step 8: Review Results

1. **Select "Get Quiz Attempt Review"**
2. **Parameters:**
   - `attemptid`: Same attempt ID
   - `page`: "-1" for all pages
3. **Execute the call**
4. **Expected Result:** Review data with:
   - Questions with correct answers
   - Your responses
   - Grades and feedback

## Common Issues and Solutions

### Issue: "You cannot attempt this quiz at this time"

**Possible Causes:**
- Quiz has time restrictions (not yet open/already closed)
- Maximum attempts reached
- Quiz requires password or specific network
- Browser security restrictions

**Debug Steps:**
1. Check Step 2 (Quiz Access Information)
2. Look at `preventaccessreasons` array
3. Check `accessrules` for restrictions
4. Verify quiz timing in Step 1 results

### Issue: "Failed to start quiz attempt"

**Possible Causes:**
- Already have an in-progress attempt
- Quiz settings prevent new attempts
- Missing required preflight data

**Debug Steps:**
1. Check Step 3 for existing attempts
2. If in-progress attempt exists, use that attempt ID
3. Check if quiz requires password in `preflightdata`

### Issue: Questions not loading

**Possible Causes:**
- Invalid attempt ID
- Attempt not properly started
- Page parameter issues

**Debug Steps:**
1. Verify attempt ID from Step 4
2. Check attempt state is "inprogress"
3. Try different page numbers (0, 1, 2, etc.)

### Issue: Answers not saving

**Possible Causes:**
- Incorrect answer data format
- Invalid question field names
- Attempt already finished

**Debug Steps:**
1. Check question HTML in Step 5 for correct field names
2. Verify attempt is still "inprogress"
3. Use exact field names from question HTML

## Answer Data Format Examples

### Text Input Questions
```json
{
  "q1838014:1_:sequencecheck": "1",
  "q1838014:1_sub1_answer": "had not done",
  "q1838014:1_sub2_answer": "had been looking"
}
```

### Multiple Choice Questions
```json
{
  "q1838014:2_:sequencecheck": "1",
  "q1838014:2_answer": "2"
}
```

### Checkbox Questions
```json
{
  "q1838014:3_:sequencecheck": "1",
  "q1838014:3_choice0": "1",
  "q1838014:3_choice2": "1"
}
```

## Tips for Successful Testing

1. **Always save the attempt ID** from Step 4 - you'll need it for all subsequent calls
2. **Check the question HTML** in Step 5 to understand the exact field names needed
3. **Test with simple answers first** before trying complex question types
4. **Use the browser's developer tools** to inspect network requests if needed
5. **Start with quizzes that have no restrictions** for initial testing

## Debugging Network Issues

If API calls are failing:

1. **Check the browser's Network tab** in Developer Tools
2. **Look for HTTP error codes** (401, 403, 500, etc.)
3. **Verify the Moodle site URL** is correct
4. **Check if your session is still valid** (try other API calls)
5. **Look at the raw response** for detailed error messages

## Next Steps

Once you've successfully tested the API calls manually:

1. **Compare with the quiz-taking component** implementation
2. **Check if the component is using the same parameters**
3. **Verify the component's error handling** matches API responses
4. **Test the component's answer formatting** against working API calls

This systematic approach will help identify exactly where the quiz-taking functionality is failing and provide the data needed to fix it. 