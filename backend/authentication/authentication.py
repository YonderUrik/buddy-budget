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

bp = Blueprint('authentication', __name__, url_prefix='/api/auth')
logger = logging.getLogger(__name__)

@bp.route('/login', methods=["POST"])
def login():
    try:
        mongo = AuthMongo()
        
        request_json = dict(request.json)
        cleaned_data, validation_errors = clean_and_validate_data(request_json)

        if validation_errors:
            logger.error(f"Validation errors: {validation_errors}")
            return {"message": validation_errors}, 400

        _email = str(cleaned_data.get("email"))
        _password = str(cleaned_data.get("password"))

        user_details = mongo.get_user_by_email(_email)

        if not user_details:
            return {"message": MSG.INVALID_CREDENTIALS_ENG}, 401

        if user_details['password'] is None:
            return {"message": MSG.RESET_PASSWORD_REQUIRED_ENG, "status": 300 }, 300

        if not check_password_hash(user_details['password'], _password):
            return {"message": MSG.INVALID_CREDENTIALS_ENG}, 401

        identity = {
            "email" : user_details['email'],
        }
        
        # Create the tokens we will be sending back to the user
        access_token = create_access_token(identity=identity)
        refresh_token = create_refresh_token(identity=identity)

        resp = jsonify({'login': True, 'user' : identity})
        set_access_cookies(resp, access_token)
        set_refresh_cookies(resp, refresh_token)
        
        return resp, 200
    except Exception as e:
        logger.error(e)
        return {"message": MSG.SOMETHING_GOES_WRONG_ENG}, 500
    
@bp.route('/register', methods=["POST"])
def register():
    try:
        mongo = AuthMongo()

        request_json = dict(request.json)
        cleaned_data, validation_errors = clean_and_validate_data(request_json)

        if validation_errors:
            logger.error(f"Validation errors: {validation_errors}")
            return {"message": validation_errors}, 400

        _firstName = str(cleaned_data.get("firstName"))
        _lastName = str(cleaned_data.get("lastName"))
        _email = str(cleaned_data.get("email"))
        _password = str(cleaned_data.get("password"))

        email_exist = mongo.get_user_by_email(_email)

        if email_exist:
            return {"message" : "Email is already associated with another account"}, 400
        
        _hashed_password = generate_password_hash(_password)

        user_doc = {
            "firstName" : _firstName,
            "lastName" : _lastName,
            "email" : _email,
            "password" : _hashed_password,
            "confirm_code" : None,
        }

        status, msg = mongo.register_user(user_doc)
        
        return {"message" : msg}, status
    except Exception as e:
        logger.error(e)
        return {"message" : MSG.SOMETHING_GOES_WRONG_ENG}, 500
    
@bp.route('/check-user-reset', methods=["POST"])
def check_user_reset():
    try:
        mongo = AuthMongo()

        request_json = dict(request.json)
        cleaned_data, validation_errors = clean_and_validate_data(request_json)

        if validation_errors:
            logger.error(f"Validation errors: {validation_errors}")
            return {"message": validation_errors}, 400
        
        _email = str(cleaned_data.get("email"))

        user_details = mongo.get_user_by_email(_email)
        
        if not user_details:
            return {"message" : "user enabled"}, 200
        
        if not user_details['confirm_code']:
            return {"message" : "user not enabled"}, 401

        return {"message" : "user enabled"}, 200
    except Exception as e:
        logger.error(e)
        return {"message" : MSG.SOMETHING_GOES_WRONG_ENG}, 500
    
@bp.route('/forgot-password', methods=["POST"])
def forgot_password():
    mongo = AuthMongo()

    request_json = dict(request.json)
    cleaned_data, validation_errors = clean_and_validate_data(request_json)

    if validation_errors:
        logger.error(f"Validation errors: {validation_errors}")
        return {"message": validation_errors}, 400
    
    _email = str(cleaned_data.get("email"))

    user_details = mongo.get_user_by_email(_email)

    if not user_details:
        return {"message": MSG.EMAIL_SENT_ENG}, 200
    
    random_code = random.randint(100000, 999999)

    status, msg = mongo.set_user_code(email=_email, code = random_code)

    if status == False:
        return {"message" , MSG.SOMETHING_GOES_WRONG_ENG}, 500
    
    msg = MSG.FORGOT_PASSWORD_EMAIL_TEMPLATE.format(code=random_code)
    recipient = _email
    subject = f"Password Reset Request {PLATFORM_URL}"

    email_driver = EmailDriver()

    if email_driver.send_email(body=msg, recipient=recipient, subject=subject) is True:
        return {"message": MSG.EMAIL_SENT_ENG}, 200
    else:
        return {"message": MSG.SOMETHING_GOES_WRONG_ENG}, 500

@bp.route('/logout', methods=["POST"])
@jwt_required()
def logout():
    resp = jsonify({'logout': True})
    unset_jwt_cookies(resp)
    return resp, 200

@bp.route('/me', methods=["GET"])
@jwt_required()
def myaccount():
    current_user = get_jwt_identity()
    
    _email = current_user['email']
    mongo = AuthMongo()

    user_details = mongo.get_user_by_email(_email)

    identity = {
        "email" : user_details['email'],
    }
    access_token = create_access_token(identity=identity)
    resp = jsonify({'refresh': True, "user": identity})
    set_access_cookies(resp, access_token)

    return resp, 200

@bp.route('/reset-password', methods=["POST"])
def reset_password():
    mongo = AuthMongo()
    
    request_json = dict(request.json['data'])
    cleaned_data, validation_errors = clean_and_validate_data(request_json)

    if validation_errors:
        logger.error(f"Validation errors: {validation_errors}")
        return {"message": validation_errors}, 400

    _email = str(cleaned_data['email'])
    _password = str(cleaned_data['password'])
    _code = int(cleaned_data['code'])

    user_details = mongo.get_user_by_email(_email)

    if not user_details:
        return {"message" : MSG.SOMETHING_GOES_WRONG_ENG}, 400
    
    if _code != user_details['confirm_code']:
        return {"message" : MSG.INVALID_CODE_ENG}, 400
    
    _hashed_password = generate_password_hash(_password)

    status, msg = mongo.set_user_new_password(_email, _hashed_password)

    if status == True:
        status = 200
        msg = MSG.PASSWORD_SETTED_ENG
    else:
        status = 500
        msg = MSG.SOMETHING_GOES_WRONG_ENG

    email_driver = EmailDriver()
    email_msg = MSG.PASSWORD_SETTED_EMAIL_TEMPLATE.format(PLATFORM_URL=PLATFORM_URL)
    recipient = _email
    subject = "Password Reset Successful"
    email_driver.send_email(body=email_msg, recipient=recipient, subject=subject)

    return {"message" : msg}, status
    


