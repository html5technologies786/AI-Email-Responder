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

## Creating BLOB Storage on Vercel

To create BLOB storage on Vercel, follow these steps:

1. **Log in to Vercel**: Log in to your Vercel account.

2. **Navigate to Your Project**: Go to the dashboard and select your project.

3. **Go to Integrations**: Click on the "Integrations" tab for your project.

4. **Add Integration**: Click on "Add Integration" and search for "BLOB Storage".

5. **Configure Integration**: Follow the prompts to configure the BLOB storage integration. You may need to provide details such as storage size and region.

6. **Save Changes**: Save the changes to add the BLOB storage to your project.

7. **Access BLOB Storage**: Once the integration is added, you can access the BLOB storage from your project dashboard.
