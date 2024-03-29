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
    status, bankExists = mongo.get_bank_by_name(
        user_id=user_id, card_name=_cardName)

    if status == False:
        return {"message": MSG.SOMETHING_GOES_WRONG_ENG}, 500

    if bankExists or _cardName == 'External wallet':
        return {"message": "This bank name already exists"}, 400

    bank_doc = {
        "cardName": _cardName,
        "balance": _currentBalance,
        "lastUpdate": datetime.utcnow()
    }

    status, msg = mongo.insert_new_bank(user_id=user_id, bank_doc=bank_doc)

    return {"message": msg}, status


@bp.route('/edit-bank', methods=["POST"])
@jwt_required()
def edit_bank():

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
    _oldBank = cleaned_data['oldBank']

    mongo = BankingMongo()

    if _cardName != _oldBank:
        status, bankExists = mongo.get_bank_by_name(
            user_id=user_id, card_name=_cardName)

        if status == False:
            return {"message": MSG.SOMETHING_GOES_WRONG_ENG}, 500

        if bankExists:
            return {"message": "This bank name already exists"}, 400

    bank_doc = {
        "cardName": _cardName,
        "balance": _currentBalance,
        "lastUpdate": datetime.utcnow()
    }

    status, msg = mongo.edit_bank(
        user_id=user_id, oldBank=_oldBank, newValues=bank_doc)

    return {"message": msg}, status


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
        return {"message": banks}, status

    return json.dumps(banks, default=str)


@bp.route('/delete-bank', methods=["POST"])
@jwt_required()
def delete_bank():
    mongo = AuthMongo()
    _user_email = get_jwt_identity()['email']
    user_details = mongo.get_user_by_email(_user_email)
    user_id = str(user_details['_id'])

    cardName = str(request.json.get('cardName'))

    mongo = BankingMongo()
    status, msg = mongo.delete_bank(user_id=user_id, cardName=cardName)

    return {"message": msg}, status


@bp.route('/get-categories', methods=["GET"])
@jwt_required()
def get_categories():
    mongo = AuthMongo()
    _user_email = get_jwt_identity()['email']
    user_details = mongo.get_user_by_email(_user_email)
    user_id = str(user_details['_id'])

    mongo = BankingMongo()
    status, res = mongo.get_categories(user_id=user_id)

    if status != 200:
        return {"message": MSG.SOMETHING_GOES_WRONG_ENG}, status

    return json.dumps(res, default=str)


@bp.route('/get-transactions', methods=["POST"])
@jwt_required()
def get_transactions():
    mongo = AuthMongo()
    _user_email = get_jwt_identity()['email']
    user_details = mongo.get_user_by_email(_user_email)
    user_id = str(user_details['_id'])

    date_format = "%Y-%m-%dT%H:%M:%S.%fZ"
    startDate = datetime.strptime(request.json.get("startDate"), date_format)
    endDate = datetime.strptime(request.json.get("endDate"), date_format)

    mongo = BankingMongo()

    status, transactions = mongo.get_transactions(
        user_id=user_id, startDate=startDate, endDate=endDate)

    if status == False:
        return {"message": MSG.SOMETHING_GOES_WRONG_ENG}, status

    return json.dumps(transactions, default=str)


@bp.route('/delete-transaction', methods=["POST"])
@jwt_required()
def delete_transaction():
    _id = request.json.get("id")

    mongo = AuthMongo()
    _user_email = get_jwt_identity()['email']
    user_details = mongo.get_user_by_email(_user_email)
    user_id = str(user_details['_id'])

    mongo = BankingMongo()
    status, transactionExists = mongo.get_single_transaction(
        user_id=user_id, transaction_id=_id)

    if status != 200:
        return {"message": MSG.SOMETHING_GOES_WRONG_ENG}, status

    if not transactionExists:
        return {"message": "Transaction not found"}, 400

    status, msg = mongo.delete_transaction(user_id=user_id, transaction_id=_id)

    return {"message": msg}, status


@bp.route('/add-transaction', methods=["POST"])
@jwt_required()
def add_transaction():
    mongo = AuthMongo()
    _user_email = get_jwt_identity()['email']
    user_details = mongo.get_user_by_email(_user_email)
    user_id = str(user_details['_id'])

    request_json = dict(request.json)

    transactionType = request_json['type']

    if transactionType == 'transfer':
        transaction_doc = {
            "type": request_json['type'],
            "cardName": request_json['cardName'],
            "cardNameTo": request_json['cardNameTo'],
            "amount": request_json['amount'],
            "date": request_json['date'],
        }

    else:
        transaction_doc = {
            "type": request_json['type'],
            "cardName": request_json['cardName'],
            "amount": request_json['amount'],
            "categoryId": request_json['category']['categoryId'],
            "subCategoryId": request_json['category']['value'],
            "date": request_json['date'],
        }

    cleaned_data, validation_errors = clean_and_validate_data(transaction_doc)

    if validation_errors:
        logger.error(f"Validation errors: {validation_errors}")
        return {"message": validation_errors}, 400

    # Check cardName in list
    mongo = BankingMongo()
    status, bankExists = mongo.get_bank_by_name(
        user_id=user_id, card_name=cleaned_data['cardName'])

    if status == False:
        return {"message": MSG.SOMETHING_GOES_WRONG_ENG}, 500

    if not bankExists and cleaned_data['cardName'] != 'External wallet':
        return {"message": "This bank name don't exists"}, 400

    if transactionType == 'transfer':

        status, bankExists = mongo.get_bank_by_name(
            user_id=user_id, card_name=cleaned_data['cardNameTo'])

        if status == False:
            return {"message": MSG.SOMETHING_GOES_WRONG_ENG}, 500

        if not bankExists and cleaned_data['cardNameTo'] != 'External wallet':
            return {"message": "This destination card name don't exists"}, 400

        # If is a transfer do some controls
        if cleaned_data['cardName'] == cleaned_data['cardNameTo']:
            return {"message": "Cannot transfer to the same bank account"}, 400

        if cleaned_data['cardName'] == 'External wallet' and cleaned_data['cardName'] == cleaned_data['cardNameTo']:
            return {"message": "Only a bank can be External wallet"}, 400

    else:
        # Else do other controlos

        # Check categoryID in list
        is_category_correct = mongo.is_category_in_list(
            user_id=user_id, categoryId=cleaned_data['categoryId'], operationType=cleaned_data['type'])

        if is_category_correct == False:
            return {"message": "Category not present"}, 400

        # Check subCategoryID in list
        is_subcategory_correct = mongo.is_subcategory_in_list(
            user_id=user_id, categoryId=cleaned_data['categoryId'], subCategoryId=cleaned_data['subCategoryId'], operationType=cleaned_data['type'])

        if is_subcategory_correct == False:
            return {"message": "Sub Category not present"}, 400

    status, msg = mongo.add_transaction(
        user_id=user_id, transaction_doc=cleaned_data)

    return {"message": msg}, status


@bp.route('/get-summary-chart', methods=["POST"])
@jwt_required()
def get_summary_chart():
    mongo = AuthMongo()
    _user_email = get_jwt_identity()['email']
    user_details = mongo.get_user_by_email(_user_email)
    user_id = str(user_details['_id'])

    date_format = "%Y-%m-%dT%H:%M:%S.%fZ"
    startDate = datetime.strptime(request.json.get("startDate"), date_format)
    endDate = datetime.strptime(request.json.get("endDate"), date_format)

    mongo = BankingMongo()
    status, summary = mongo.get_summary_of_month_for_chart(
        user_id=user_id, startDate=startDate, endDate=endDate)

    if status != 200:
        return {"message": MSG.SOMETHING_GOES_WRONG_ENG}, status

    return json.dumps(summary, default=str)


@bp.route('/get-expenses-category-chart', methods=["POST"])
@jwt_required()
def get_expenses_category_chart():
    mongo = AuthMongo()
    _user_email = get_jwt_identity()['email']
    user_details = mongo.get_user_by_email(_user_email)
    user_id = str(user_details['_id'])

    categoryMonthSelected = int(request.json.get('categoryMonthSelected'))
    categoryYearSelected = int(request.json.get('categoryYearSelected'))

    mongo = BankingMongo()
    status, summary = mongo.get_expenses_category_chart(
        user_id=user_id, month=categoryMonthSelected, year=categoryYearSelected)

    if status != 200:
        return {"message": MSG.SOMETHING_GOES_WRONG_ENG}, status

    return json.dumps(summary, default=str)


@bp.route('/get-distinct-user-data-year', methods=["POST"])
@jwt_required()
def get_distinct_user_data_year():
    mongo = AuthMongo()
    _user_email = get_jwt_identity()['email']
    user_details = mongo.get_user_by_email(_user_email)
    user_id = str(user_details['_id'])

    mongo = BankingMongo()

    status, distinct_years = mongo.get_distinct_user_data_year(user_id=user_id)

    if status != 200:
        return {"message": MSG.SOMETHING_GOES_WRONG_ENG}, status

    return json.dumps(distinct_years, default=str)


@bp.route('/get-summary-net-worth', methods=["POST"])
@jwt_required()
def get_summary_net_worth():
    mongo = AuthMongo()
    _user_email = get_jwt_identity()['email']
    user_details = mongo.get_user_by_email(_user_email)
    user_id = str(user_details['_id'])

    mongo = BankingMongo()
    status, summary = mongo.get_summary_net_worth(user_id=user_id)

    if status != 200:
        return {"message": MSG.SOMETHING_GOES_WRONG_ENG}, status

    return json.dumps(summary, default=str)


@bp.route('/get-general-infos', methods=["POST"])
@jwt_required()
def get_saving_rate():
    try:
        mongo = AuthMongo()
        _user_email = get_jwt_identity()['email']
        user_details = mongo.get_user_by_email(_user_email)
        user_id = str(user_details['_id'])

        mongo = BankingMongo()
        status, saving_rate = mongo.get_saving_rates(user_id=user_id)

        if status != 200:
            raise Exception(saving_rate)
        
        status , mean_of_expenses = mongo.get_mean_of_expenses(user_id=user_id)

        if status != 200:
            raise Exception(mean_of_expenses)
        
        expenses_of_year = (mean_of_expenses * 12) * 25
        status, allBanks =  mongo.get_all_banks(user_id=user_id)

        print(allBanks[0]['balance'] / expenses_of_year)
        doc_to_return = {
            "savingRate" : saving_rate[0]['savingRate'] * 100,
            "meanExpenseByMonth" : mean_of_expenses,
            "FIRE" : (allBanks[0]['balance'] / expenses_of_year) * 100,
        }

        return json.dumps(doc_to_return, default=str)
    except Exception as e:
        logger.error(e)
        return {"message": MSG.SOMETHING_GOES_WRONG_ENG}, 500
