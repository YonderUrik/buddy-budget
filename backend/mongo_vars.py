DB_NAME = 'budget-tracker'
USERS_COLLECTION = 'users'

# DB of every user is identified by his _id
BANKS_COLLECTION = 'banks'
TRANSACTION_COLLECTION = 'transactions'
SETTINGS_COLLECTION = 'settings'
ASSETS_TRANSACTIONS_COLLECTION = 'assets_transactions'
ASSETS_INFO_COLLECTION = 'assets_info'
ASSETS_HISTORICAL_DATE = 'assets_historical_date'


DEFAULT_CATEGORIE = {
  "out": [
    {
      "category_id": 1,
      "category_name": "Home",
      "subcategories": [
        {
          "subcategory_id": 1,
          "subcategory_name": "Mortgage/Rent"
        },
        {
          "subcategory_id": 2,
          "subcategory_name": "Home Insurance"
        },
        {
          "subcategory_id": 3,
          "subcategory_name": "Property Taxes"
        },
        {
          "subcategory_id": 4,
          "subcategory_name": "Home Updates/Repairs"
        },
        {
          "subcategory_id": 5,
          "subcategory_name": "Housing Association Fees"
        },
        {
          "subcategory_id": 6,
          "subcategory_name": "Utilities",
          "subcategories": [
            {
              "subcategory_id": 1,
              "subcategory_name": "Electricity"
            },
            {
              "subcategory_id": 2,
              "subcategory_name": "Water/Hot Water"
            },
            {
              "subcategory_id": 3,
              "subcategory_name": "Heat"
            },
            {
              "subcategory_id": 4,
              "subcategory_name": "Air Conditioning"
            },
            {
              "subcategory_id": 5,
              "subcategory_name": "Garbage Or Recycling"
            },
            {
              "subcategory_id": 6,
              "subcategory_name": "Cable TV"
            },
            {
              "subcategory_id": 7,
              "subcategory_name": "Internet"
            },
            {
              "subcategory_id": 8,
              "subcategory_name": "Cell Phone"
            },
            {
              "subcategory_id": 9,
              "subcategory_name": "Landline Phone"
            }
          ]
        }
      ]
    },
    {
      "category_id": 2,
      "category_name": "Transportation",
      "subcategories": [
        {
          "subcategory_id": 1,
          "subcategory_name": "Car Payment"
        },
        {
          "subcategory_id": 2,
          "subcategory_name": "Car Insurance"
        },
        {
          "subcategory_id": 3,
          "subcategory_name": "Gas"
        },
        {
          "subcategory_id": 4,
          "subcategory_name": "Parking"
        },
        {
          "subcategory_id": 5,
          "subcategory_name": "Registration"
        },
        {
          "subcategory_id": 6,
          "subcategory_name": "Maintenance"
        },
        {
          "subcategory_id": 7,
          "subcategory_name": "Repairs"
        },
        {
          "subcategory_id": 8,
          "subcategory_name": "Inspections"
        },
        {
          "subcategory_id": 9,
          "subcategory_name": "Roadside Assistance"
        },
        {
          "subcategory_id": 10,
          "subcategory_name": "Taxi/Rideshare"
        },
        {
          "subcategory_id": 11,
          "subcategory_name": "Bus or Train"
        },
        {
          "subcategory_id": 12,
          "subcategory_name": "Tolls"
        }
      ]
    },
    {
      "category_id": 3,
      "category_name": "Food",
      "subcategories": [
        {
          "subcategory_id": 1,
          "subcategory_name": "Groceries"
        },
        {
          "subcategory_id": 2,
          "subcategory_name": "Dining out"
        },
        {
          "subcategory_id": 3,
          "subcategory_name": "Snacks"
        },
        {
          "subcategory_id": 4,
          "subcategory_name": "Drinks"
        }
      ]
    },
    {
      "category_id": 4,
      "category_name": "Medical",
      "subcategories": [
        {
          "subcategory_id": 1,
          "subcategory_name": "Medications"
        },
        {
          "subcategory_id": 2,
          "subcategory_name": "Dental Visits"
        },
        {
          "subcategory_id": 3,
          "subcategory_name": "Vision Care"
        },
        {
          "subcategory_id": 4,
          "subcategory_name": "Medical Equipment"
        },
        {
          "subcategory_id": 5,
          "subcategory_name": "Medical Insurance"
        },
        {
          "subcategory_id": 6,
          "subcategory_name": "Dental Insurance"
        },
        {
          "subcategory_id": 7,
          "subcategory_name": "Life Insurance"
        },
        {
          "subcategory_id": 8,
          "subcategory_name": "Paramedical Services"
        }
      ]
    },
    {
      "category_id": 5,
      "category_name": "Personal",
      "subcategories": [
        {
          "subcategory_id": 1,
          "subcategory_name": "Clothes"
        },
        {
          "subcategory_id": 2,
          "subcategory_name": "Shoes"
        },
        {
          "subcategory_id": 3,
          "subcategory_name": "Furniture"
        },
        {
          "subcategory_id": 4,
          "subcategory_name": "Home Appliances"
        },
        {
          "subcategory_id": 5,
          "subcategory_name": "Home Décor"
        },
        {
          "subcategory_id": 6,
          "subcategory_name": "Cleaning Supplies"
        },
        {
          "subcategory_id": 7,
          "subcategory_name": "Personal Supplies"
        },
        {
          "subcategory_id": 8,
          "subcategory_name": "Hair Services"
        },
        {
          "subcategory_id": 9,
          "subcategory_name": "Nail Services"
        },
        {
          "subcategory_id": 10,
          "subcategory_name": "Cosmetics"
        },
        {
          "subcategory_id": 11,
          "subcategory_name": "Spa Services"
        },
        {
          "subcategory_id": 12,
          "subcategory_name": "Massage Therapy"
        },
        {
          "subcategory_id": 13,
          "subcategory_name": "Cigarettes"
        }
      ]
    },
    {
      "category_id": 6,
      "category_name": "Entertainment",
      "subcategories": [
        {
          "subcategory_id": 1,
          "subcategory_name": "Streaming Services"
        },
        {
          "subcategory_id": 2,
          "subcategory_name": "Subscriptions"
        },
        {
          "subcategory_id": 3,
          "subcategory_name": "Memberships"
        },
        {
          "subcategory_id": 4,
          "subcategory_name": "Outings"
        },
        {
          "subcategory_id": 5,
          "subcategory_name": "Hobbies"
        },
        {
          "subcategory_id": 6,
          "subcategory_name": "Sports"
        },
        {
          "subcategory_id": 7,
          "subcategory_name": "Vacations"
        },
        {
          "subcategory_id": 8,
          "subcategory_name": "Softwares"
        }
      ]
    },
    {
      "category_id": 7,
      "category_name": "Education",
      "subcategories": [
        {
          "subcategory_id": 1,
          "subcategory_name": "Tuition"
        },
        {
          "subcategory_id": 2,
          "subcategory_name": "Textbooks"
        },
        {
          "subcategory_id": 3,
          "subcategory_name": "Supplies"
        }
      ]
    },
    {
      "category_id": 8,
      "category_name": "Gifts",
      "subcategories": [
        {
          "subcategory_id": 1,
          "subcategory_name": "Birthdays"
        },
        {
          "subcategory_id": 2,
          "subcategory_name": "Holidays"
        },
        {
          "subcategory_id": 3,
          "subcategory_name": "Anniversaries"
        },
        {
          "subcategory_id": 4,
          "subcategory_name": "Donations"
        },
        {
          "subcategory_id": 5,
          "subcategory_name": "Weddings"
        },
        {
          "subcategory_id": 6,
          "subcategory_name": "Baby Showers"
        },
        {
          "subcategory_id": 7,
          "subcategory_name": "Teacher Gifts"
        }
      ]
    },
    {
      "category_id": 9,
      "category_name": "Children",
      "subcategories": [
        {
          "subcategory_id": 1,
          "subcategory_name": "Daycare"
        },
        {
          "subcategory_id": 2,
          "subcategory_name": "Babysitters"
        },
        {
          "subcategory_id": 3,
          "subcategory_name": "Activities"
        },
        {
          "subcategory_id": 4,
          "subcategory_name": "Child Supplies"
        },
        {
          "subcategory_id": 5,
          "subcategory_name": "Alimony"
        }
      ]
    },
    {
      "category_id": 10,
      "category_name": "Pets",
      "subcategories": [
        {
          "subcategory_id": 1,
          "subcategory_name": "Pet Food"
        },
        {
          "subcategory_id": 2,
          "subcategory_name": "Pet Insurance"
        },
        {
          "subcategory_id": 3,
          "subcategory_name": "Pet Supplies"
        },
        {
          "subcategory_id": 4,
          "subcategory_name": "Vet Visits/Checkups"
        },
        {
          "subcategory_id": 5,
          "subcategory_name": "Training"
        }
      ]
    },
    {
      "category_id": 11,
      "category_name": "Debt",
      "subcategories": [
        {
          "subcategory_id": 1,
          "subcategory_name": "Credit Cards"
        },
        {
          "subcategory_id": 2,
          "subcategory_name": "Lines Of Credit"
        },
        {
          "subcategory_id": 3,
          "subcategory_name": "Personal Loans"
        },
        {
          "subcategory_id": 4,
          "subcategory_name": "Student Loans"
        }
      ]
    },
    {
      "category_id": 13,
      "category_name": "Miscellaneous",
      "subcategories": [
        {
          "subcategory_id": 1,
          "subcategory_name": "Credit Card Fees"
        },
        {
          "subcategory_id": 2,
          "subcategory_name": "Bank Account Fees"
        },
        {
          "subcategory_id": 3,
          "subcategory_name": "Student Loan Fees"
        }
      ]
    }
  ],
  "in": [
    {
      "category_id": 1,
      "category_name": "Employment Income",
      "subcategories": [
        {
          "subcategory_id": 1,
          "subcategory_name": "Full-Time Job"
        },
        {
          "subcategory_id": 2,
          "subcategory_name": "Bonuses"
        },
        {
          "subcategory_id": 3,
          "subcategory_name": "Part-Time Job"
        },
        {
          "subcategory_id": 4,
          "subcategory_name": "Seasonal Job"
        },
        {
          "subcategory_id": 5,
          "subcategory_name": "Tax Refund"
        }
      ]
    },
        {
      "category_id": 2,
      "category_name": "Investments",
      "subcategories": [
        {
          "subcategory_id": 6,
          "subcategory_name": "Dividends"
        },
        {
          "subcategory_id": 7,
          "subcategory_name": "Interest Income"
        },
        {
          "subcategory_id": 8,
          "subcategory_name": "Capital Gains"
        }
      ]
    },
    {
      "category_id": 3,
      "category_name": "Rental Income",
      "subcategories": [
        {
          "subcategory_id": 9,
          "subcategory_name": "Property Rental"
        },
        {
          "subcategory_id": 10,
          "subcategory_name": "Room Rental"
        },
        {
          "subcategory_id": 11,
          "subcategory_name": "Vacation Rental"
        }
      ]
    },
    {
      "category_id": 4,
      "category_name": "Business Income",
      "subcategories": [
        {
          "subcategory_id": 12,
          "subcategory_name": "Sales Revenue"
        },
        {
          "subcategory_id": 13,
          "subcategory_name": "Service Income"
        },
        {
          "subcategory_id": 14,
          "subcategory_name": "Consulting Fees"
        }
      ]
    },
    {
      "category_id": 5,
      "category_name": "Other Income",
      "subcategories": [
        {
          "subcategory_id": 15,
          "subcategory_name": "Gifts"
        },
        {
          "subcategory_id": 16,
          "subcategory_name": "Awards"
        },
        {
          "subcategory_id": 17,
          "subcategory_name": "Alimony"
        }
      ]
    }
  ],
  "type": "budgetting-categories"
}