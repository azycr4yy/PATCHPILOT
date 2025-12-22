import scrapy
class Bookstoscrap(scrapy.Spider):
    name = "books"
    url = [
        'https://books.toscrape.com/'
    ]
    def parse(self, response):
        book_name = response.css