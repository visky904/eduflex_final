# 🏗️ Architecture & Data Flow Diagrams

## Overall System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    EduFlex Platform (v1.2)                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────────┐          ┌──────────────────────┐    │
│  │   Teacher Dashboard  │          │   Student Interface  │    │
│  ├──────────────────────┤          ├──────────────────────┤    │
│  │ • Create Session     │          │ • Join by Code       │    │
│  │ • Create Activities  │◄────────►│ • Join by Link       │    │
│  │   - MCQ              │ WebSocket│ • Answer Questions   │    │
│  │   - Word Cloud       │ Sync     │ • Submit Responses   │    │
│  │   - Reviews          │          │ • View Results       │    │
│  │   - Feedback         │          │                      │    │
│  │   - Q&A ✨ NEW       │          │                      │    │
│  │   - Wordle           │          │                      │    │
│  │ • View Results       │          │                      │    │
│  │ • Share Link ✨ NEW  │          │                      │    │
│  │ • Copy to Clipboard  │          │                      │    │
│  └──────────────────────┘          └──────────────────────┘    │
│           │                                  │                 │
│           └──────────────┬───────────────────┘                 │
│                          │                                     │
│                          ▼                                     │
│                 ┌────────────────┐                             │
│                 │ React Router   │                             │
│                 │ URL Handling   │                             │
│                 │ /join/{CODE}   │────────────────┐            │
│                 └────────────────┘                │            │
│                          │                        │            │
│                          ▼                        ▼            │
│            ┌─────────────────────────────────────────┐         │
│            │  Firebase Firestore (Real-time DB)     │         │
│            ├─────────────────────────────────────────┤         │
│            │ /sessions/{roomCode}                   │         │
│            │ ├── roomCode: "AB1C23"                 │         │
│            │ ├── isSessionLive: true/false          │         │
│            │ ├── currentActivity: {...}             │         │
│            │ └── /responses                         │         │
│            │     ├── {docId}: {response}            │         │
│            │     └── ...                            │         │
│            └─────────────────────────────────────────┘         │
│                                                                 │
│  ┌────────────────────────────────────┐                       │
│  │ Browser/Tab 1: Teacher              │                       │
│  │ http://localhost:3000/teacher       │                       │
│  └────────────────────────────────────┘                       │
│                                                                 │
│  ┌────────────────────────────────────┐                       │
│  │ Browser/Tab 2: Student (Link Join)  │                       │
│  │ http://localhost:3000/join/AB1C23   │────────┐             │
│  └────────────────────────────────────┘        │             │
│                                               ✨ NEW          │
│  ┌────────────────────────────────────┐        │             │
│  │ Browser/Tab 3: Student (Code Join)  │        │             │
│  │ http://localhost:3000/             │────────┘             │
│  │ + Manual code entry                │                      │
│  └────────────────────────────────────┘                      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Q&A Feature Data Flow

```
TEACHER SIDE:
┌──────────────────────┐
│  Q&A Creator Form    │
├──────────────────────┤
│ [Question Type]      │  ┌─────────────────────┐
│ [Question Text]  ───►│  Validate Input       │
│ [Time Limit]         │  Store in State       │
│ [Options (MCQ)]      │  Update renderCreator │
│ [Correct Answer]     │  Display Live Results │
└──────────────────────┘ └─────────────────────┘
         │                        │
         ▼                        ▼
   [Click Start]          Update Firestore
         │                /sessions/{code}
         │                /currentActivity
         ▼
┌──────────────────────┐
│  Firestore Update    │
├──────────────────────┤
│ activity: {          │
│   type: "qa",        │
│   questions: [...],  │
│   currentQuestion: 0 │
│ }                    │
└──────────────────────┘


STUDENT SIDE:
┌──────────────────────┐
│  Activity Listener   │  Real-time listener
├──────────────────────┤  on Firestore
│ Wait for activity    │  /sessions/{code}
│ Display question     │
└──────────────────────┘
         │
         ▼
┌──────────────────────┐
│  Question Renderer   │
├──────────────────────┤
│ ┌─────────────────┐  │
│ │  Short Answer:  │  │
│ │  [Input Field]  │  │
│ │  [Submit]       │  │
│ └─────────────────┘  │
│ ┌─────────────────┐  │
│ │  Long Answer:   │  │
│ │  [Text Area]    │  │
│ │  [Submit]       │  │
│ └─────────────────┘  │
│ ┌─────────────────┐  │
│ │  Multiple Choice:   │
│ │  [Option 1] [Opt 2] │
│ │  [Option 3]     │  │
│ └─────────────────┘  │
└──────────────────────┘
         │
         ▼
    [Student Submits]
         │
         ▼
┌──────────────────────┐
│  Create Response Doc │
├──────────────────────┤
│ {                    │
│   answer: "...",     │
│   type: "qa",        │
│   timestamp: "..."   │
│ }                    │
└──────────────────────┘
         │
         ▼
Upload to Firestore
/sessions/{code}
/responses/{docId}
         │
         ▼
┌──────────────────────┐
│  Teacher Dashboard   │  Real-time update
├──────────────────────┤  via onSnapshot
│ Live Responses       │  listener
│ - Student answer 1   │
│ - Student answer 2   │
│ - Delete button      │
└──────────────────────┘
```

---

## Share Link Feature Data Flow

```
TEACHER CLICKS "SHARE LINK":
┌──────────────────────────────────┐
│  TeacherView.setShowShareLink()  │
│  Set state: showShareLink = true │
└──────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────┐
│  Share Link Modal Renders        │
├──────────────────────────────────┤
│ ┌──────────────────────────────┐ │
│ │ Share Session Modal          │ │
│ ├──────────────────────────────┤ │
│ │ Shareable Link:              │ │
│ │ http://localhost:3000/join   │ │
│ │ /AB1C23                      │ │
│ ├──────────────────────────────┤ │
│ │ [Copy Link Button]           │ │
│ │   onclick: handleCopyLink()  │ │
│ └──────────────────────────────┘ │
└──────────────────────────────────┘
         │
         ▼
  navigator.clipboard
  .writeText(shareLink)
         │
         ▼
┌──────────────────────────────────┐
│  Link Copied to Clipboard        │
│  Button shows "Copied!" for 2s   │
└──────────────────────────────────┘


STUDENT CLICKS SHARED LINK:
┌──────────────────────────────────┐
│  Browser URL Changes to:         │
│  /join/AB1C23                    │
└──────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────┐
│  App Component useEffect          │
├──────────────────────────────────┤
│ window.location.pathname match:  │
│ /\/join\/([A-Z0-9]+)/i           │
│                                  │
│ Extract: AB1C23                  │
│ Set: initialJoinCode = "AB1C23"  │
│ Set: view = "student"            │
└──────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────┐
│  StudentView Renders             │
├──────────────────────────────────┤
│ Props: initialJoinCode="AB1C23"  │
│                                  │
│ State: enteredCode pre-filled    │
│ State: joined = true             │
└──────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────┐
│  StudentView useEffect (2nd)     │
├──────────────────────────────────┤
│ if (initialJoinCode) {           │
│   joinSession(initialJoinCode)   │
│   - Get session from Firestore   │
│   - Setup listener               │
│   - Update sessionData state     │
│   - Skip code entry form         │
│ }                                │
└──────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────┐
│  Real-time Sync Established      │
├──────────────────────────────────┤
│ onSnapshot listener active       │
│ When teacher starts activity:    │
│ - Receive currentActivity        │
│ - Render question/activity       │
│ - Ready for student response     │
└──────────────────────────────────┘
```

---

## Component Hierarchy

```
App
├── initialJoinCode (from URL)
├── roomCode (from teacher session)
├── view state
│
├─ View: "home" ─►  HomePage
│                   ├─ [Create Session]
│                   └─ [Join Session]
│
├─ View: "teacher" ─► TeacherView ✨ UPDATED
│                    ├─ Sidebar (with Q&A option)
│                    ├─ QaCreator ✨ NEW
│                    │  ├─ Question Editor
│                    │  ├─ Options Manager
│                    │  └─ Live Results
│                    ├─ McqCreator
│                    ├─ WordCloudCreator
│                    ├─ ReviewsCreator
│                    ├─ ShortFeedbackCreator
│                    ├─ WordleCreator
│                    ├─ Analysis Modal
│                    ├─ Participants Modal
│                    └─ ShareLink Modal ✨ NEW
│
└─ View: "student" ─► StudentView ✨ UPDATED
                    ├─ Join Form (if not auto-joined)
                    └─ Activity Renderer
                       ├─ renderActivity()
                       │  ├─ MCQ display
                       │  ├─ WordCloud input
                       │  ├─ Reviews buttons
                       │  ├─ Feedback textarea
                       │  ├─ Q&A form ✨ NEW
                       │  └─ Wordle game
                       └─ Thank you screen
```

---

## State Management Flow

```
┌─────────────────────────────────────────┐
│  Application State Changes              │
├─────────────────────────────────────────┤
│                                         │
│  User Opens App                         │
│  └─► App mounts                         │
│      └─► Check URL: /join/{CODE}?      │
│          ├─► Yes: initialJoinCode set  │
│          │   setView("student")        │
│          │   Auto-join logic           │
│          └─► No: view = "home"         │
│                                         │
│  User Creates Session                   │
│  └─► handleSetView("teacher")           │
│      └─► generateRoomCode()             │
│          └─► Create in Firestore       │
│              └─► setView("teacher")    │
│                  └─► TeacherView loads │
│                                         │
│  User Clicks "Share Link"               │
│  └─► setShowShareLink(true)             │
│      └─► Modal renders                  │
│          └─► handleCopyLink()           │
│              └─► setLinkCopied(true)   │
│                  └─► 2s timeout        │
│                      └─► Reset         │
│                                         │
│  Student Joins via Link                 │
│  └─► initialJoinCode passed             │
│      └─► joinSession() called           │
│          └─► onSnapshot listener       │
│              └─► sessionData updated   │
│                  └─► Activity renders  │
│                                         │
│  Teacher Creates Q&A Question           │
│  └─► setActivity({...})                 │
│      └─► State updated                  │
│          └─► renderCreator() updates   │
│              └─► handleStartSession()  │
│                  └─► Firestore update  │
│                      └─► Students get  │
│                          question      │
│                                         │
│  Student Answers Question               │
│  └─► handleSubmit(answer)               │
│      └─► addDoc() to responses          │
│          └─► Firestore updates         │
│              └─► Teacher sees live     │
│                  response               │
│                                         │
└─────────────────────────────────────────┘
```

---

## Firestore Collection Schema

```
firebaseProject/
│
└── sessions/ (Collection)
    │
    └── {roomCode}/ (Document)
        │   [Fields]
        │   - roomCode: string (AB1C23)
        │   - isSessionLive: boolean
        │   - currentActivity: object
        │     ├── type: "qa"
        │     ├── questions: array
        │     │  └── [0]:
        │     │      ├── id: number
        │     │      ├── text: string
        │     │      ├── type: "short" | "long" | "multiple"
        │     │      ├── options: array (if type="multiple")
        │     │      ├── correctAnswer: string
        │     │      └── timeLimit: number
        │     └── currentQuestionIndex: number
        │
        └── responses/ (Subcollection)
            │
            ├── {docId1}/ (Document) ✨ Q&A Response
            │   - answer: string
            │   - type: "qa"
            │   - timestamp: Timestamp
            │
            ├── {docId2}/ (Document)
            │   - answer: string
            │   - type: "qa"
            │   - timestamp: Timestamp
            │
            └── ...
```

---

## URL Routing Examples

```
┌───────────────────────────────────────────┐
│  URL Patterns & Routing                   │
├───────────────────────────────────────────┤
│                                           │
│  http://localhost:3000                    │
│  └─► App home page                        │
│      [Create Session] [Join Session]      │
│                                           │
│  http://localhost:3000/join               │
│  └─► Join session form                    │
│      Manual code entry                    │
│                                           │
│  http://localhost:3000/join/AB1C23        │
│  └─► Auto-join session (NEW)              │
│      Parse code: AB1C23                   │
│      Pre-fill form                        │
│      Auto-establish connection            │
│                                           │
│  http://localhost:3000/join/ab1c23        │
│  └─► Same as above                        │
│      (Converted to uppercase)             │
│                                           │
│  http://localhost:3000/join/INVALID       │
│  └─► Error: Session not found             │
│                                           │
└───────────────────────────────────────────┘
```

---

## Event Flow Diagram

```
                         TEACHER SIDE
                         ───────────

Teacher creates Q&A
        │
        ▼
   Sidebar shows "Q&A Session"
        │
        ▼
   Question Editor Opens
        │
        ├─► Add Question 1 (Short Answer)
        ├─► Add Question 2 (Multiple Choice)
        └─► Set time limits
        │
        ▼
   Click "Start Interaction"
        │
        ▼
   Activity sent to Firestore
        │
        ◄──────────────────────────────────┐
        │                              Real-time
        │                              Sync
        ▼                                  │
   Live Results Updates              STUDENT SIDE
        │                            ──────────── 
        │                                 │
   ┌────┴────────────────────────────────►┤
   │                                  │
   │    Student receives question     │
   │    in StudentView                │
   │                                 │
   │    Question renders:             │
   │    "What is ____?"              │
   │    [Text Input]                 │
   │    [Submit Button]              │
   │                                 │
   │    Student types answer         │
   │    └─► onchange listener        │
   │        updates feedbackText     │
   │                                 │
   │    Student clicks Submit        │
   │    └─► handleSubmit(answer)    │
   │        └─► Validation          │
   │            └─► Profanity check │
   │                └─► Add to DB   │
   │                    └─► Response
   │                        uploaded
   │                                 │
   │                            ◄────┘
   │
   │ Real-time listener triggered
   │ liveResponses state updates
   │ Renders Live Results Modal
   │ Shows: "Answer: Paris"
   │ With delete button
   │
   └──────────────────────────────────►
```

---

## Component Re-render Triggers

```
TeacherView Re-renders when:
├─ currentActivityType changes
│  └─► Activity state reset
├─ activity state changes
│  └─► renderCreator() updates
├─ liveResponses updates
│  └─► Real-time DB listener fires
├─ isSessionLive changes
│  └─► Button state changes
├─ showResults toggle
│  └─► Modal visibility
├─ showParticipants toggle
│  └─► Modal visibility
└─ showShareLink toggle ✨ NEW
   └─► Share Modal visibility

StudentView Re-renders when:
├─ enteredCode changes
│  └─► Form input updated
├─ joined state changes
│  └─► Shows activity or form
├─ sessionData changes (Firestore listener)
│  └─► New question/activity
├─ submitted state changes
│  └─► Shows thank you or form
├─ feedbackText changes
│  └─► Text input updated
└─ initialJoinCode prop changes ✨ NEW
   └─► Auto-join logic triggered
```

---

**Diagram Version**: 1.0  
**Last Updated**: November 1, 2025
