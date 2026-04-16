
# Exporting to Google Maps
```
./scripts/export.sh
```
This will download from Airtable and create an export file in ./build which 
will be ready to be imported in Google maps.

# Creating the pdf
virtualenv .env
. ./.env/bin/activate
pip3 install -r requirements.txt

python3 src/main.py
