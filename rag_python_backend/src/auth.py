import os
from dotenv import load_dotenv
from fastapi import HTTPException, Request
from clerk_backend_api.security import authenticate_request
from clerk_backend_api.security.types import AuthenticateRequestOptions

load_dotenv()

CLERK_SECRET_KEY = os.getenv("CLERK_SECRET_KEY")
CLIENT_URL = os.getenv("CLIENT_URL")

auth_options = AuthenticateRequestOptions(
    secret_key=CLERK_SECRET_KEY,
    authorized_parties=[CLIENT_URL],
    accepts_token=["session_token"]
)

def get_current_user(request: Request) -> str:
    auth_state = authenticate_request(request,auth_options)

    if not auth_state.is_signed_in:
        raise HTTPException(status_code=401,detail="Invalid or missing authentication token")
    
    user_id = (auth_state.payload or {}).get("sub")

    if not user_id:
        raise HTTPException(status_code=401,detail="User ID missing from token")
    
    return user_id