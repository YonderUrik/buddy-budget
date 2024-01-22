
from mongo_base import BaseMongo
import mongo_vars as MONGO_VARS
import app_msgs as MSG
import logging
import yfinance as yf
from datetime import datetime, timedelta
import pandas as pd
import numpy as np  # Import numpy for handling non-summable columns


logger = logging.getLogger(__name__)

# Function to handle summation or set to None for non-summable columns


def safe_sum(col):
    print(col)
    try:
        if col.name in ['current_value', 'total_invested']:
            return np.sum(col)  # Try to sum the column
        elif col.name == 'longName':
            return 'Total'
        else:
            return ''
    except (TypeError, ValueError):
        return ''  # Set to None if the column is not summable


class AssetsMongo(BaseMongo):
    """
    Mongo driver for authentication queries
    """

    def __init__(self):
        """
        Init AssetsMongo -> Extend BaseMongo 
        """
        super(AssetsMongo, self).__init__()

    def get_user_asset_symbol_info(self, symbol=None, user_id=None):
        try:
            if not symbol or not user_id:
                raise Exception("no symbol or user_id")

            symbol_info = self.client[user_id][MONGO_VARS.ASSETS_INFO_COLLECTION].find_one({
                                                                                           "symbol": symbol})
            return 200, symbol_info
        except Exception as e:
            return 500, str(e)

    def get_asset_historical_date(self, symbol=None):
        try:
            if not symbol:
                raise Exception("no symbol")

            return 200, list(self.client[MONGO_VARS.DB_NAME][MONGO_VARS.ASSETS_HISTORICAL_DATE].find({"symbol": symbol}, {"_id": 0}))
        except Exception as e:
            return 500, str(e)

    def add_refresh_asset_info(self, asset=None, user_id=None, refresh=False):
        try:
            if not asset or not user_id:
                raise Exception("no asset or user_id")

            if refresh == True:
                self.client[user_id][MONGO_VARS.ASSETS_INFO_COLLECTION].delete_one(
                    {"symbol": asset['symbol']})

            self.client[user_id][MONGO_VARS.ASSETS_INFO_COLLECTION].insert_one(
                asset)

            return 200, "success"
        except Exception as e:
            return 500, str(e)

    def add_asset_transaction(self, user_id=None, transaction=None):
        try:
            if not user_id or not transaction:
                raise Exception("no user_id or transaction")

            self.client[user_id][MONGO_VARS.ASSETS_TRANSACTIONS_COLLECTION].insert_one(
                transaction)

            return 200, "success"
        except Exception as e:
            return 500, str(e)

    def insert_historical_data(self, symbol=None, startDate=None):
        try:
            collection = self.client[MONGO_VARS.DB_NAME][MONGO_VARS.ASSETS_HISTORICAL_DATE]

            start_previous_day_time = datetime(
                startDate.year, startDate.month, startDate.day) - timedelta(days=1)
            start_previous_day_time = datetime(
                start_previous_day_time.year, start_previous_day_time.month, start_previous_day_time.day, 22, 0, 0)
            end_previous_day_time = datetime(
                startDate.year, startDate.month, startDate.day, 21, 0, 0)
            historical_of_that_day = collection.find_one(
                {"Date": {"$gte": start_previous_day_time, "$lte": end_previous_day_time}, 'symbol': symbol})

            if not historical_of_that_day:
                historical_after_that_day = collection.find_one(
                    {"Date": {"$gt": historical_of_that_day}, 'symbol': symbol})
                if not historical_after_that_day:
                    today = datetime.utcnow()
                    endDate = f"{today.year}-{today.month}-{today.day}"
                else:
                    endDate = historical_after_that_day['Date'] - \
                        timedelta(days=1)
                    endDate = f"{endDate.year}-{endDate.month}-{endDate.day}"

                ticker = yf.Ticker(symbol)
                hist = ticker.history(
                    start=f"{startDate.year}-{startDate.month}-{startDate.day}", end=endDate)
                hist['symbol'] = symbol
                collection.insert_many(hist.reset_index().to_dict("records"))
            return 200, "ok"
        except Exception as e:
            print(str(e))
            return 500, str(e)

    def get_assets_list_and_last_info(self, user_id=None):
        try:
            if not user_id:
                raise Exception("no user_id")

            assets_info = pd.DataFrame(self.client[user_id][MONGO_VARS.ASSETS_INFO_COLLECTION].find(
                {}, {"symbol": 1, "longName": 1, 'currency': 1, 'quoteType': 1}))

            if assets_info.empty:
                return 200, []

            asset_transactions = pd.DataFrame(
                self.client[user_id][MONGO_VARS.ASSETS_TRANSACTIONS_COLLECTION].find({}))

            # Calculate total cost and total value
            asset_transactions['total_value'] = asset_transactions['price_in'] * \
                asset_transactions['quantity']

            grouped = asset_transactions.groupby('symbol').agg({
                'quantity': 'sum',
                'amount': 'sum',
                'fee': 'sum'
            }).reset_index()

            # Perform aggregation to get the latest document for each symbol
            pipeline = [
                {"$match": {"symbol": {"$in": grouped['symbol'].to_list()}}},
                # Sort documents by date in descending order
                {"$sort": {"Date": -1}},
                {"$group": {
                    "_id": "$symbol",  # Group by symbol
                    # Get the first document after sorting (which has the latest date)
                    "latest_doc": {"$first": "$$ROOT"}
                }},
                # Replace the root with the latest document
                {"$replaceRoot": {"newRoot": "$latest_doc"}}
            ]
            last_prices = pd.DataFrame(
                self.client[MONGO_VARS.DB_NAME][MONGO_VARS.ASSETS_HISTORICAL_DATE].aggregate(pipeline))

            merged_df = pd.merge(grouped, last_prices,
                                 on='symbol', how='outer')
            merged_df = pd.merge(merged_df, assets_info,
                                 on='symbol', how='outer')

            merged_df['current_value'] = merged_df['quantity'] * \
                merged_df['Close']
            merged_df['total_invested'] = merged_df['amount'] + \
                merged_df['fee']
            merged_df['pmc'] = merged_df['total_invested'] / \
                merged_df['quantity']
            merged_df['percentage'] = (
                merged_df['current_value'] - merged_df['total_invested']) / merged_df['total_invested']

            merged_df = merged_df[['symbol', 'longName', 'quantity', 'current_value',
                                   'total_invested', 'pmc', 'percentage', 'currency', 'Date', 'quoteType']]
            return 200, merged_df.to_dict("records")

        except Exception as e:
            logger.error(e)
            return 500, str(e)

    def get_asset_transactions(self, user_id=None, symbol=None):
        try:
            collection = self.client[user_id][MONGO_VARS.ASSETS_TRANSACTIONS_COLLECTION]
            return 200, list(collection.find({"symbol": symbol}).sort('date', -1))
        except Exception as e:
            return 500, str(e)
