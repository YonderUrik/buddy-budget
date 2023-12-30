from flask import request, Blueprint, jsonify
from werkzeug.security import check_password_hash
from werkzeug.security import generate_password_hash
from flask_jwt_extended import create_access_token
from flask_jwt_extended import jwt_required
from flask_jwt_extended import get_jwt_identity
from flask_jwt_extended import set_access_cookies
from flask_jwt_extended import unset_jwt_cookies
from flask_jwt_extended import create_refresh_token
from flask_jwt_extended import set_refresh_cookies
import app_msgs as MSG
import logging
from authentication.mongo import AuthMongo
import random
from app_vars import PLATFORM_URL
from email_driver import EmailDriver
from utils_function import clean_and_validate_data
from app_vars import POLYGON_API_KEY
import requests
import json

bp = Blueprint('assets', __name__, url_prefix='/api/assets')
logger = logging.getLogger(__name__)

@bp.route('/get-keyword-suggestion', methods=["POST"])
@jwt_required()
def get_keyword_suggestion():
    query = request.json.get("keyword")

    if query.strip() == '':
        return {"message" : "Please insert an asset name"}, 400

    api_key = "63966f4347bb2ddcf23b45e25a7389cc25e25623"
    headers = {
        'Content-Type': 'application/json',
        'Authorization' : f'Token {api_key}'
    }
    requestResponse = requests.get(f"https://api.tiingo.com/tiingo/utilities/search?query={query}", headers=headers)
    if requestResponse.status_code == 200:
        return json.dumps(requestResponse.json(), default=str)
    else:
        print(requestResponse)
        return {"message" : "Something went wrong, please retry in a few minutes"}, 500

    




