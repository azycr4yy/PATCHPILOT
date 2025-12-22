import scrapy
class QnASpider(scrapy.Spider):
    name = "qa_spider"
    start_urls = [
        'https://github.com/agentskills/agentskills'
    ]
    def parse(self, response):
        question = response.css('h1::text').extract()
        yield {'question': question}