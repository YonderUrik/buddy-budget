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
    keyword = request.json.get("keyword")

    # TODO: 
    # Checks if the keyword is already included in the list of the 
    # ticker previously extracted

    url = f'https://api.polygon.io/v3/reference/tickers?search={keyword}&apiKey={POLYGON_API_KEY}'

    req = requests.get(url)

    if req.status_code != 200:
        return {"message" : MSG.SOMETHING_GOES_WRONG_ENG}, req.status_code
    
    json_request = req.json()
    
    if 'results' in json_request and len(json_request['results']) > 0:
        print("AGGIUNTO TICKER")
        pass
    

    
    return json.dumps(json_request, default=str)
    




