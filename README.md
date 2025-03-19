## Deployment Instructions

To deploy the backend, follow these steps:

1. Install PM2 globally:
    ```sh
    npm install pm2 -g
    ```

2. Clone the git repository:
    ```sh
    git clone <repository-url>
    ```

3. Update the `.env` file with the necessary environment variables.

4. Start the application using PM2:
    ```sh
    pm2 start index.js
    ```

5. Save the PM2 process list:
    ```sh
    pm2 save
    ```

6. Restart all PM2 processes:
    ```sh
    pm2 restart all
    ```

## Build and Import Thunderbird Extension

1. Update the `frontend/manifest` file with the necessary environment variables.

2. Build and import the Thunderbird extension:
    ```sh
    cd frontend
    npm install
    npm run build
    ```

