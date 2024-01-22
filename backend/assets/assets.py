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
import yfinance as yf
from assets.mongo import AssetsMongo
from datetime import datetime

bp = Blueprint('assets', __name__, url_prefix='/api/assets')
logger = logging.getLogger(__name__)

@bp.route('/get-keyword-suggestion', methods=["POST"])
@jwt_required()
def get_keyword_suggestion():
    try:
        query = request.json.get("keyword")

        if query.strip() == '':
            return {"message" : "Please insert an asset name"}, 400

        ticker = yf.Ticker(query.strip())
        return json.dumps(ticker.info, default=str)
    except Exception as e:
        logger.error(e)
        return {"message" : "Ticker not found"}, 500
    
@bp.route('/get-assets', methods=["POST"])
@jwt_required()
def get_assets():
    try:
        mongo = AuthMongo()
        _user_email = get_jwt_identity()['email']
        user_details = mongo.get_user_by_email(_user_email)
        user_id = str(user_details['_id'])

        mongo = AssetsMongo()

        status, result = mongo.get_assets_list_and_last_info(user_id=user_id)

        if status != 200:
            raise Exception(result)
        
        return json.dumps(result, default=str)
    except Exception as e:
        logger.error(e)
        return {"message" : MSG.SOMETHING_GOES_WRONG_ENG}, 500
    
@bp.route('/get-symbol-history', methods=["POST"])
@jwt_required()
def get_symbol_history():
    try:
        mongo = AuthMongo()
        symbol = request.json.get('symbol', None)

        mongo = AssetsMongo()

        status, symbol_history = mongo.get_asset_historical_date(symbol=symbol)

        if status != 200 or not symbol_history:
            raise Exception(symbol_history)

        return json.dumps(symbol_history, default=str)
    except Exception as e:
        logger.error(e)
        return {"message" : MSG.SOMETHING_GOES_WRONG_ENG}, 500
    
@bp.route('/get-symbol-info', methods=["POST"])
@jwt_required()
def get_symbol_info():
    try:
        mongo = AuthMongo()
        _user_email = get_jwt_identity()['email']
        user_details = mongo.get_user_by_email(_user_email)
        user_id = str(user_details['_id'])

        symbol = request.json.get('symbol', None)

        mongo = AssetsMongo()

        status, symbol_info = mongo.get_user_asset_symbol_info(symbol=symbol, user_id=user_id)

        if status != 200 or symbol_info == None:
            raise Exception(symbol_info)

        ticker = yf.Ticker(symbol)
        return json.dumps(ticker.info, default=str)
    except Exception as e:
        logger.error(e)
        return {"message" : MSG.SOMETHING_GOES_WRONG_ENG}, 500
    
@bp.route('/add-new-asset', methods=["POST"])
@jwt_required()
def add_new_asset():
    try:
        mongo = AuthMongo()
        _user_email = get_jwt_identity()['email']
        user_details = mongo.get_user_by_email(_user_email)
        user_id = str(user_details['_id'])

        selectedAsset = request.json.get('selectedAsset')
        assetSymbol = selectedAsset['symbol']

        mongo = AssetsMongo()

        if not assetSymbol:
            # The asset is a new one, so i need to insert ex-novo
            status, msg = mongo.add_refresh_asset_info(asset=selectedAsset, user_id=user_id)
        else:
            # The asset is already in, but i refresh the infos
            status, msg = mongo.add_refresh_asset_info(asset=selectedAsset, user_id=user_id, refresh=True)

        if status != 200:
            raise Exception(msg)
        
        buyInfo = request.json.get('buyInfo')

        buyInfo['symbol'] = selectedAsset['symbol']
        buyInfo['longName'] = selectedAsset['longName']
        buyInfo['type'] = 'buy'

        try:
            # Define the format of the input string
            date_format = "%Y-%m-%dT%H:%M:%S.%fZ"
            # Convert the string to a datetime object
            buyInfo['date'] = datetime.strptime(buyInfo['date'], date_format)
        except:
            raise Exception("The date is not a valid data type")

        #GET Historical data
        status, msg = mongo.insert_historical_data(symbol=assetSymbol, startDate=buyInfo['date'])
        
        status, msg = mongo.add_asset_transaction(user_id=user_id, transaction=buyInfo)

        if status != 200:
            raise Exception(msg)
        
        return {"message" : "Transaction added successfully"}, 200
    except Exception as e:
        return {"message" : MSG.SOMETHING_GOES_WRONG_ENG}, 500
    
@bp.route('/get-transaction-history', methods=["POST"])
@jwt_required()
def get_transaction_history():
    try:
        mongo = AuthMongo()
        _user_email = get_jwt_identity()['email']
        user_details = mongo.get_user_by_email(_user_email)
        user_id = str(user_details['_id'])

        symbol = request.json.get("symbol")

        mongo = AssetsMongo()
        status, history = mongo.get_asset_transactions(user_id=user_id, symbol=symbol)

        if status != 200:
            raise Exception(history)
        
        return json.dumps(history, default=str)
    except Exception as e:
        logger.error(e)
        return {"message" : MSG.SOMETHING_GOES_WRONG_ENG}, 500
    




