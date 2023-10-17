from flask import request, Blueprint, jsonify
from flask_jwt_extended import jwt_required
import app_msgs as MSG
import logging
from utils_function import clean_and_validate_data
from banking.mongo import BankingMongo
from authentication.mongo import AuthMongo
from datetime import datetime
import json
from flask_jwt_extended import get_jwt_identity

bp = Blueprint('banking', __name__, url_prefix='/api/banking')
logger = logging.getLogger(__name__)

@bp.route('/add-bank', methods=["POST"])
@jwt_required()
def add_bank():

    request_json = dict(request.json)

    cleaned_data, validation_errors = clean_and_validate_data(request_json)

    if validation_errors:
        logger.error(f"Validation errors: {validation_errors}")
        return {"message": validation_errors}, 400
    
    mongo = AuthMongo()
    _user_email = get_jwt_identity()['email']
    user_details = mongo.get_user_by_email(_user_email)
    user_id = str(user_details['_id'])


    _cardName = cleaned_data['cardName']
    _currentBalance = cleaned_data['balance']

    mongo = BankingMongo()
    status, bankExists = mongo.get_bank_by_name(user_id=user_id, card_name=_cardName)

    if status == False:
        return {"message" : MSG.SOMETHING_GOES_WRONG_ENG}, 500
    
    if bankExists:
        return {"message" : "This bank name already exists"}, 400
    
    bank_doc = {
        "cardName" : _cardName,
        "balance" : _currentBalance,
        "lastUpdate" : datetime.utcnow()
    }

    status, msg = mongo.insert_new_bank(user_id=user_id, bank_doc=bank_doc)

    return {"message" : msg}, status

@bp.route('/get-banks', methods=["GET"])
@jwt_required()
def get_banks():
    mongo = AuthMongo()
    _user_email = get_jwt_identity()['email']
    user_details = mongo.get_user_by_email(_user_email)
    user_id = str(user_details['_id'])

    mongo = BankingMongo()
    status, banks = mongo.get_all_banks(user_id=user_id)

    if status != 200:
        return {"message" : banks}, status
    
    print(banks)
    
    return json.dumps(banks, default=str)






