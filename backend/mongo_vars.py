DB_NAME = 'budget-tracker'
USERS_COLLECTION = 'users'

# DB of every user is identified by his _id
BANKS_COLLECTION = 'banks'
TRANSACTION_COLLECTION = 'transactions'
SETTINGS_COLLECTION = 'settings'

DEFAULT_CATEGORIE = {
  "out": [
    {
      "category_id": 1,
      "category_name": "Housing",
      "subcategories": [
        {
          "subcategory_id": 1,
          "subcategory_name": "Rent"
        },
        {
          "subcategory_id": 2,
          "subcategory_name": "Mortgage"
        },
        {
          "subcategory_id": 3,
          "subcategory_name": "Property Taxes"
        },
        {
          "subcategory_id": 4,
          "subcategory_name": "Home Insurance"
        },
        {
          "subcategory_id": 5,
          "subcategory_name": "Utilities"
        }
      ]
    },
    {
      "category_id": 2,
      "category_name": "Transportation",
      "subcategories": [
        {
          "subcategory_id": 6,
          "subcategory_name": "Gas and Fuel"
        },
        {
          "subcategory_id": 7,
          "subcategory_name": "Public Transportation"
        },
        {
          "subcategory_id": 8,
          "subcategory_name": "Car Loan"
        },
        {
          "subcategory_id": 9,
          "subcategory_name": "Insurance"
        },
        {
          "subcategory_id": 10,
          "subcategory_name": "Maintenance"
        }
      ]
    },
    {
      "category_id": 3,
      "category_name": "Groceries",
      "subcategories": [
        {
          "subcategory_id": 11,
          "subcategory_name": "Food"
        },
        {
          "subcategory_id": 12,
          "subcategory_name": "Beverages"
        },
        {
          "subcategory_id": 13,
          "subcategory_name": "Household Supplies"
        }
      ]
    },
    {
      "category_id": 4,
      "category_name": "Utilities",
      "subcategories": [
        {
          "subcategory_id": 14,
          "subcategory_name": "Electricity"
        },
        {
          "subcategory_id": 15,
          "subcategory_name": "Water"
        },
        {
          "subcategory_id": 16,
          "subcategory_name": "Gas"
        },
        {
          "subcategory_id": 17,
          "subcategory_name": "Internet"
        },
        {
          "subcategory_id": 18,
          "subcategory_name": "Phone"
        }
      ]
    },
    {
      "category_id": 5,
      "category_name": "Health",
      "subcategories": [
        {
          "subcategory_id": 19,
          "subcategory_name": "Health Insurance"
        },
        {
          "subcategory_id": 20,
          "subcategory_name": "Medical Expenses"
        },
        {
          "subcategory_id": 21,
          "subcategory_name": "Prescriptions"
        },
        {
          "subcategory_id": 22,
          "subcategory_name": "Gym Memberships"
        }
      ]
    },
    {
      "category_id": 6,
      "category_name": "Education",
      "subcategories": [
        {
          "subcategory_id": 23,
          "subcategory_name": "Tuition"
        },
        {
          "subcategory_id": 24,
          "subcategory_name": "Books and Supplies"
        },
        {
          "subcategory_id": 25,
          "subcategory_name": "Educational Tools"
        }
      ]
    },
    {
      "category_id": 7,
      "category_name": "Entertainment",
      "subcategories": [
        {
          "subcategory_id": 26,
          "subcategory_name": "Dining Out"
        },
        {
          "subcategory_id": 27,
          "subcategory_name": "Movies"
        },
        {
          "subcategory_id": 28,
          "subcategory_name": "Hobbies"
        },
        {
          "subcategory_id": 29,
          "subcategory_name": "Subscriptions"
        }
      ]
    },
    {
      "category_id": 8,
      "category_name": "Personal Care",
      "subcategories": [
        {
          "subcategory_id": 30,
          "subcategory_name": "Clothing"
        },
        {
          "subcategory_id": 31,
          "subcategory_name": "Haircuts"
        },
        {
          "subcategory_id": 32,
          "subcategory_name": "Toiletries"
        }
      ]
    },
    {
      "category_id": 9,
      "category_name": "Savings",
      "subcategories": [
        {
          "subcategory_id": 33,
          "subcategory_name": "Emergency Fund"
        },
        {
          "subcategory_id": 34,
          "subcategory_name": "Retirement"
        },
        {
          "subcategory_id": 35,
          "subcategory_name": "Investments"
        }
      ]
    },
    {
      "category_id": 10,
      "category_name": "Debt",
      "subcategories": [
        {
          "subcategory_id": 36,
          "subcategory_name": "Credit Card Payments"
        },
        {
          "subcategory_id": 37,
          "subcategory_name": "Student Loan Payments"
        },
        {
          "subcategory_id": 38,
          "subcategory_name": "Personal Loan Payments"
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
          "subcategory_name": "Salary"
        },
        {
          "subcategory_id": 2,
          "subcategory_name": "Bonuses"
        },
        {
          "subcategory_id": 3,
          "subcategory_name": "Commissions"
        },
        {
          "subcategory_id": 4,
          "subcategory_name": "Tips"
        },
        {
          "subcategory_id": 5,
          "subcategory_name": "Freelance Income"
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