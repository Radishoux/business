const { execSync } = require("child_process");
const dayjs = require("dayjs");

// Configuration
const DAYS_OF_WEEK = 7; // Total days in a week
const TOTAL_WEEKS = 52; // Total weeks to simulate
const MAX_PUSHES_PER_DAY = 5; // Max pushes on a single day
const MIN_PUSHES_PER_DAY = 0; // Min pushes on a single day
const COMMITS_PER_PUSH = [1, 8]; // Random range of commits per push

// Weights for daily push activity (Sunday = 0, Monday = 6)
const DAY_WEIGHTS = [1, 10, 8, 7, 9, 6, 2]; // Higher weight = more pushes

// Helper functions
const getRandomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

// Ensure the script is running in a Git repository
const initializeGit = () => {
  try {
    execSync("git status", { stdio: "ignore" });
  } catch {
    console.log("Initializing a new Git repository...");
    execSync("git init");
  }
};

// Generate commits for a given month
const generatePushesForMonth = async (startWeek, endWeek) => {
  const today = dayjs();
  const startDate = today.subtract(TOTAL_WEEKS, "weeks");

  for (let week = startWeek; week < endWeek; week++) {
    const currentWeekStart = startDate.add(week, "week");

    for (let day = 0; day < DAYS_OF_WEEK; day++) {
      const pushesToday = getRandomInt(
        MIN_PUSHES_PER_DAY,
        Math.ceil(MAX_PUSHES_PER_DAY * (DAY_WEIGHTS[day] / 10))
      );

      for (let push = 0; push < pushesToday; push++) {
        const commitsInPush = getRandomInt(COMMITS_PER_PUSH[0], COMMITS_PER_PUSH[1]);

        for (let commit = 0; commit < commitsInPush; commit++) {
          const commitTimestamp = currentWeekStart
            .add(day, "day")
            .add(getRandomInt(9, 21), "hour")
            .add(getRandomInt(0, 59), "minute")
            .add(getRandomInt(0, 59), "second")
            .format("YYYY-MM-DDTHH:mm:ss");

          // Create a dummy commit without generating a file
          execSync(
            `git commit --allow-empty --date="${commitTimestamp}" -m "Simulated commit on ${commitTimestamp}"`,
            { env: { ...process.env, GIT_AUTHOR_DATE: commitTimestamp, GIT_COMMITTER_DATE: commitTimestamp } }
          );
        }

        console.log(
          `Week ${week + 1}, Day ${day + 1}: Push ${push + 1} with ${commitsInPush} commits`
        );
      }
    }
  }
};

// Connect to GitHub if not already connected
const setupRemote = (repoURL) => {
  try {
    execSync(`git remote add origin ${repoURL}`);
    console.log(`Added remote: ${repoURL}`);
  } catch {
    console.log("Remote already exists or failed to add. Continuing...");
  }
};

// Main execution
const main = async () => {
  const repoURL = "https://github.com/Radishoux/business.git"; // Replace with your repo URL
  setupRemote(repoURL);

  initializeGit();

  // Split the year into 12 months (approx. 4 weeks per month)
  const monthlyRanges = [
    [0, 4],   // January
    [4, 8],   // February
    [8, 13],  // March
    [13, 17], // April
    [17, 21], // May
    [21, 26], // June
    [26, 30], // July
    [30, 35], // August
    [35, 39], // September
    [39, 43], // October
    [43, 47], // November
    [47, 52], // December
  ];

  console.log("Generating randomized commits and simulating pushes...");

  // Run each month in parallel
  await Promise.all(
    monthlyRanges.map(([start, end]) => generatePushesForMonth(start, end))
  );

  // Push everything at the end
  console.log("Pushing all commits to remote...");
  try {
    execSync("git push origin main || echo 'Simulated push'");
  } catch (error) {
    console.error("Error during push:", error.message);
  }

  console.log("Randomized push simulation complete!");
};

main().catch((err) => console.error("Error during execution:", err.message));
