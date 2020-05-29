import json
import os
from urllib import request, parse

THRESHOLD = 3000000000000000000 # 3 ETH
FAUCET_ADDRESS = '0x179E20BA056FF73A8161d3E3bbC1627CB12e88cC'
INFURA_API_TOKEN = os.environ['INFURA_API_TOKEN']
GITHUB_BOT_TOKEN = os.environ['GITHUB_BOT_TOKEN']

def get_faucet_balance():
    url = f'https://rinkeby.infura.io/v3/{INFURA_API_TOKEN}'

    data_dict = {
        'jsonrpc': '2.0',
        'id': 4,
        'method': 'eth_getBalance',
        'params': [FAUCET_ADDRESS, 'latest']
    }

    headers = {'Content-Type': 'application/json'}

    data = json.dumps(data_dict)

    req = request.Request(url, data.encode(), headers)
    with request.urlopen(req) as resp:
        result_decoded = (resp.read()).decode()
        result_json = json.loads(result_decoded)

        # hex string to int
        balance = int(result_json['result'], 16)

        return balance

def submit_github_issue(balance):
    url = 'https://api.github.com/repos/omisego/plasma-contracts/issues'

    data_dict = {
        'title': 'Faucet address of CI is in low balance!',
        'body': f'Please send some fund to the poor faucet: `{FAUCET_ADDRESS}`.  '\
                f'Current balance is: `{balance}` wei',
    }

    headers = {
        'Accept': 'application/vnd.github.v3+json',
        'authorization': f'token {GITHUB_BOT_TOKEN}'
    }

    data = json.dumps(data_dict)

    req = request.Request(url, data.encode(), headers)
    request.urlopen(req)
    with request.urlopen(req) as resp:
        result = (resp.read()).decode()
        print('GH submission result:', result)


if __name__ == "__main__":
    balance = get_faucet_balance()
    print('Faucet balance:', balance, '(wei)')

    if balance < THRESHOLD:
        print('balance is low, submitting GH issue...')
        submit_github_issue(balance)
