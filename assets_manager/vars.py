import os
from dotenv import load_dotenv
load_dotenv()

DB_NAME = 'budget-tracker'
USERS_COLLECTION = 'users'

mongodb_username = os.getenv("mongodb_username", "change-me")
mongodb_password = os.getenv("mongodb_password", "change-me")

try:
    HOST_NAME = os.getenv("HOST_NAME")
except:
    HOST_NAME = '0.0.0.0'