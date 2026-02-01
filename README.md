# Vietnamese IME with AI Word Prediction

A Vietnamese input method editor with GPT-2 based word prediction.

## Project Structure

├── backend/
│ ├── testing.py # Flask API server
│ ├── test_api.py # API testing script
│ └── requirements.txt # Python dependencies
└── frontend/
├── index.html # Main interface
├── style.css # Styling
└── ime.js # IME logic

## Prerequisites

### **System Requirements:**
- Python 3.8 or higher
- pip (Python package manager)
- Modern web browser (Chrome/Firefox/Edge)
- **Minimum 4GB RAM** (GPT-2 model is large)

### **Step-by-Step Setup:**

1. **Clone/Download the project**
   ```bash
   git clone YOUR_REPOSITORY_URL
   cd vietnamese_ime_project

2. **Backend Setup**
    cd backend
    pip install -r requirements.txt
    python testing.py

    This downloads the GPT-2 model (~500MB) on first run

    Server runs at: http://localhost:5000

    Test with: python test_api.py

3. **Frontend Setup**
    Open frontend/index.html in any browser

    Ensure backend is running on port 5000

***Important Notes***
1. First run will take 5-10 minutes to download the GPT-2 model
2. Internet connection required for initial model download
3. Port 5000 must be available (no other services using it)
