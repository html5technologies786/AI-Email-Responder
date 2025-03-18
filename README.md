## Running and Deploying the Backend on Vercel

To run and deploy the backend on Vercel, follow these steps:

1. **Prepare and Run the Backend Locally**: Navigate to the `backend` directory, install the necessary dependencies, and start the backend server locally to ensure it is working.

   ```bash
   cd backend
   npm install
   npm run dev
   ```

2. **Create an `.env` File**: Create an `.env` file in the `backend` directory by copying the `example.env.txt` file and adding the necessary environment variables.

   ```bash
   cp example.env.txt .env
   ```

   Add your environment variables to the `.env` file.

3. **Deploy to Vercel**: Log in to your Vercel account and use the Vercel CLI to deploy the backend.

   ```bash
   vercel
   ```

   Follow the prompts to deploy the backend. Make sure to set the appropriate environment variables in the Vercel dashboard.

## Generating a BLOB Token from Vercel

To generate a BLOB token from Vercel, follow these steps:

1. **Log in to Vercel**: Log in to your Vercel account.

2. **Navigate to Your Project**: Go to the dashboard and select your project.

3. **Go to Settings**: Click on the "Settings" tab for your project.

4. **Environment Variables**: Scroll down to the "Environment Variables" section.

5. **Add New Variable**: Click on "Add New Variable" and enter the key as `BLOB_TOKEN`.

6. **Generate Token**: Use the Vercel CLI or API to generate a new token. You can use the following command to generate a token:

   ```bash
   vercel token
   ```

7. **Set the Token**: Copy the generated token and set it as the value for the `BLOB_TOKEN` environment variable.

8. **Save Changes**: Save the changes to update the environment variables.

9. **Deploy**: Redeploy your project to apply the new environment variable.

Once the deployment is complete, your application will have access to the `BLOB_TOKEN` environment variable.

## Importing the Extension to Thunderbird

To import the extension to Thunderbird, follow these steps:

1. **Build the Extension**: Navigate to the `frontend` directory and build the extension.

   ```bash
   cd frontend
   npm install
   npm run build
   ```

2. **Create an `.env` File**: Create an `.env` file in the `frontend` directory by copying the `example.env.txt` file and adding the necessary environment variables.

   ```bash
   cp example.env.txt .env
   ```

   Add your environment variables to the `.env` file.

3. **Locate the Extension Files**: After building, locate the extension files in the `extension` directory.

4. **Open Thunderbird**: Open Thunderbird and go to the Add-ons Manager.

5. **Install the Extension**: Click on the gear icon and select "Debug Add-ons" and Click on "Load Temporary Add-on...". Navigate to the `extension` directory and select the built extension file (e.g., `manifest.json`).

6. **Enable the Extension**: After installation, make sure the extension is enabled in the Add-ons Manager.
