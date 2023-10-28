from flask import request, Blueprint, jsonify
from flask_jwt_extended import jwt_required
import app_msgs as MSG
import logging
from utils_function import clean_and_validate_data
from account.mongo import AccountMongo
from authentication.mongo import AuthMongo
from datetime import datetime
import json
from werkzeug.security import check_password_hash
from werkzeug.security import generate_password_hash
from flask_jwt_extended import get_jwt_identity

bp = Blueprint('account', __name__, url_prefix='/api/account')
logger = logging.getLogger(__name__)

@bp.route('/change-password', methods=["POST"])
@jwt_required()
def change_password():
    mongo = AuthMongo()
    _user_email = get_jwt_identity()['email']
    user_details = mongo.get_user_by_email(_user_email)

    request_json = dict(request.json)

    cleaned_data, validation_errors = clean_and_validate_data(request_json)

    if validation_errors:
        logger.error(f"Validation errors: {validation_errors}")
        return {"message": validation_errors}, 400
    
    if not check_password_hash(user_details['password'], cleaned_data['oldPassword']):
        return {"message" : "Old password incorrect, retry"}, 401
    
    if not cleaned_data['newPassword'] == cleaned_data['confirmNewPassword']:
        return {"message" : "Passwords don't match, retry"}, 401
    
    _hashed_password = generate_password_hash(cleaned_data['newPassword'])

    mongo = AccountMongo()
    status, msg = mongo.change_password(email=_user_email, newPassword=_hashed_password)

    return {"message" : msg}, status
    

    



