# How to Build the Android APK Locally

This guide will walk you through the process of building the Android APK for this project on your local machine.

## 1. Prerequisites

Before you begin, you will need to have the following software installed on your computer:

*   **Node.js and npm:** You can download and install Node.js from the official website: [https://nodejs.org/](https://nodejs.org/)
*   **Java Development Kit (JDK):** We recommend using OpenJDK 17. You can download it from the Adoptium website: [https://adoptium.net/temurin/releases/](https://adoptium.net/temurin/releases/)
*   **Android Studio:** Download and install Android Studio from the official Android developer website: [https://developer.android.com/studio](https://developer.android.com/studio)

## 2. Environment Setup

After installing the prerequisites, you need to configure your environment variables.

### Setting `JAVA_HOME`

The `JAVA_HOME` environment variable should point to the directory where you installed the JDK.

*   **macOS and Linux:**
    Open your terminal and add the following line to your shell's configuration file (e.g., `~/.bashrc`, `~/.zshrc`):

    ```bash
    export JAVA_HOME="/path/to/your/jdk"
    ```

    Replace `/path/to/your/jdk` with the actual path to your JDK installation.

*   **Windows:**
    1.  Open the **System Properties** window.
    2.  Click on the **Environment Variables** button.
    3.  In the **System variables** section, click **New...**.
    4.  Set the **Variable name** to `JAVA_HOME` and the **Variable value** to the path of your JDK installation (e.g., `C:\Program Files\Java\jdk-17`).

### Setting `ANDROID_SDK_ROOT`

The `ANDROID_SDK_ROOT` environment variable should point to the directory where the Android SDK is located. This is usually managed by Android Studio.

1.  Open Android Studio.
2.  Go to **Tools > SDK Manager**.
3.  At the top of the window, you'll see the **Android SDK Location**. Copy this path.
4.  Set the `ANDROID_SDK_ROOT` environment variable using the same method you used for `JAVA_HOME`.

    *   **macOS and Linux:**

        ```bash
        export ANDROID_SDK_ROOT="/path/to/your/android-sdk"
        ```

    *   **Windows:**
        Create a new system variable with the name `ANDROID_SDK_ROOT` and the value as the path you copied from Android Studio.

## 3. Building the APK

Now that your environment is set up, you can build the APK.

### Step 1: Install Project Dependencies

Open your terminal or command prompt, navigate to the `frontend` directory of the project, and run the following command to install the necessary dependencies:

```bash
npm install
```

### Step 2: Sync the Capacitor Project

Next, you need to sync the Capacitor project to update the Android native project with your web app.

```bash
npx cap sync
```

### Step 3: Build the APK using Gradle

Finally, you can build the APK using the Gradle wrapper in the `android` directory.

1.  Open your terminal or command prompt.
2.  Navigate to the `frontend/android` directory.
3.  Run the following command:

    *   **macOS and Linux:**

        ```bash
        ./gradlew assembleRelease
        ```

    *   **Windows:**

        ```bash
        gradlew.bat assembleRelease
        ```

If you encounter a "platform encoding not initialized" error, you can try setting the `GRADLE_OPTS` environment variable before running the build command:

*   **macOS and Linux:**

    ```bash
    export GRADLE_OPTS=-Dfile.encoding=UTF-8
    ./gradlew assembleRelease
    ```

*   **Windows:**

    ```powershell
    $env:GRADLE_OPTS="-Dfile.encoding=UTF-8"
    .\gradlew.bat assembleRelease
    ```

## 4. Locating the APK

After the build is complete, you can find the generated APK file in the following directory:

`frontend/android/app/build/outputs/apk/release/app-release.apk`

---

That's it! You should now have a signed release APK that you can install on an Android device or upload to the Google Play Store.
