import sys
import os

# Add the backend directory to sys.path
sys.path.append(os.path.join(os.path.dirname(__file__), '../backend'))

from nexus.main import app

# Set the root path for Vercel deployment
# This allows FastAPI to handle requests routed to /api/py correctly
app.root_path = "/api/py"
