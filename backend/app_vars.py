import os
from dotenv import load_dotenv
load_dotenv()

try:
    JWT_SECRET_KEY = open(os.environ.get('JWT_SECRET_KEY')).read()
except Exception:
    JWT_SECRET_KEY = 'change-me'

try:
    HOST_NAME = os.getenv("HOST_NAME")
except:
    HOST_NAME = '0.0.0.0'

try:
    APP_PORT = int(os.getenv("APP_PORT"))
except:
    APP_PORT = 5000

try:
    EMAIL_DRIVER_SETTINGS = {
        "client_id" : open(os.environ.get('client_id')).read(),
        "client_secret" : open(os.environ.get('client_secret')).read(),
        "token_path" : os.environ.get('token_path')
    }
except Exception:
    EMAIL_DRIVER_SETTINGS = {
        "client_id" : 'change-me', #change-me
        "client_secret" : 'change-me', #change-me
        "token_path" : 'change.me'#change-me
    }

mongodb_username = os.getenv("mongodb_username")
mongodb_password = os.getenv("mongodb_password")

MONGO_HOST = os.environ.get('MONGO_HOST', 'localhost:27017')
TLSCAFILE = os.getenv("TLSCAFILE", '/ssl/ca-chain.cert.pem')
TLSCERTIFICATEKEYFILE =os.getenv('TLSCERTIFICATEKEYFILE', '/ssl/crawler.client.all.pem')

PLATFORM_URL = 'http://localhost:3000' #CHANGE-ME