#!/usr/bin/env python3
"""
Upload SocialEnrollr project files to Google Drive.

Setup:
1. Go to https://console.cloud.google.com/
2. Create a project, enable Google Drive API
3. Create OAuth 2.0 Client ID (Desktop App)
4. Download JSON -> rename to credentials.json -> place in this directory
5. pip install google-auth google-auth-oauthlib google-api-python-client
6. python upload_to_gdrive.py
"""

import os
import sys
import argparse
from pathlib import Path

# Files/dirs to skip
SKIP = {'.git', '__pycache__', 'venv', 'ENV', '.env', '*.db', 'node_modules',
        'credentials.json', 'token.json', '*.pyc', 'instance', 'data'}


def should_skip(name):
    if name in SKIP:
        return True
    for pattern in SKIP:
        if pattern.startswith('*') and name.endswith(pattern[1:]):
            return True
    return False


def get_drive_service():
    from google.auth.transport.requests import Request
    from google.oauth2.credentials import Credentials
    from google_auth_oauthlib.flow import InstalledAppFlow
    from googleapiclient.discovery import build

    SCOPES = ['https://www.googleapis.com/auth/drive.file']
    creds = None
    token_path = Path(__file__).parent / 'token.json'
    creds_path = Path(__file__).parent / 'credentials.json'

    if token_path.exists():
        creds = Credentials.from_authorized_user_file(str(token_path), SCOPES)

    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            if not creds_path.exists():
                print("ERROR: credentials.json not found.")
                print("Download OAuth 2.0 Client ID from Google Cloud Console.")
                sys.exit(1)
            flow = InstalledAppFlow.from_client_secrets_file(str(creds_path), SCOPES)
            creds = flow.run_local_server(port=0)
        token_path.write_text(creds.to_json())

    return build('drive', 'v3', credentials=creds)


def find_or_create_folder(service, name, parent_id=None):
    query = f"name='{name}' and mimeType='application/vnd.google-apps.folder' and trashed=false"
    if parent_id:
        query += f" and '{parent_id}' in parents"

    results = service.files().list(q=query, spaces='drive', fields='files(id, name)').execute()
    files = results.get('files', [])

    if files:
        return files[0]['id']

    metadata = {
        'name': name,
        'mimeType': 'application/vnd.google-apps.folder'
    }
    if parent_id:
        metadata['parents'] = [parent_id]

    folder = service.files().create(body=metadata, fields='id').execute()
    return folder.get('id')


def upload_file(service, filepath, parent_id):
    from googleapiclient.http import MediaFileUpload

    filename = os.path.basename(filepath)
    media = MediaFileUpload(filepath, resumable=True)
    metadata = {
        'name': filename,
        'parents': [parent_id]
    }

    # Check if file exists, update if so
    query = f"name='{filename}' and '{parent_id}' in parents and trashed=false"
    existing = service.files().list(q=query, fields='files(id)').execute().get('files', [])

    if existing:
        service.files().update(fileId=existing[0]['id'], media_body=media).execute()
        print(f"  Updated: {filename}")
    else:
        service.files().create(body=metadata, media_body=media, fields='id').execute()
        print(f"  Uploaded: {filename}")


def upload_directory(service, local_path, parent_id):
    for item in sorted(os.listdir(local_path)):
        if should_skip(item):
            continue

        full_path = os.path.join(local_path, item)

        if os.path.isdir(full_path):
            print(f"\n  [Folder] {item}/")
            folder_id = find_or_create_folder(service, item, parent_id)
            upload_directory(service, full_path, folder_id)
        else:
            upload_file(service, full_path, parent_id)


def main():
    parser = argparse.ArgumentParser(description='Upload SocialEnrollr to Google Drive')
    parser.add_argument('--folder', default='SocialEnrollr',
                        help='Google Drive folder name (default: SocialEnrollr)')
    args = parser.parse_args()

    print(f"Connecting to Google Drive...")
    service = get_drive_service()

    # Create root folder path (supports nested like "Projects/SocialEnrollr")
    folder_parts = args.folder.split('/')
    parent_id = None
    for part in folder_parts:
        parent_id = find_or_create_folder(service, part.strip(), parent_id)

    print(f"Uploading to Drive folder: {args.folder}")
    project_dir = os.path.dirname(os.path.abspath(__file__))
    upload_directory(service, project_dir, parent_id)

    print(f"\nDone! All files uploaded to Google Drive: {args.folder}")


if __name__ == '__main__':
    main()
