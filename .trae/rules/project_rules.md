---
description: 
globs: 
alwaysApply: false
---
# Data Types and Models

TabTime uses several core data types to represent and manipulate usage data. These types are defined in [src/types/index.ts](mdc:src/types/index.ts).

## TabTimeRecord

Records a single instance of tab usage:

```typescript
interface TabTimeRecord {
  url: string;              // Tab URL
  title: string;            // Tab title
  domain: string;           // Extracted domain name
  timeSpent: number;        // Time spent in milliseconds
  date: string;             // Date in YYYY-MM-DD format
  lastActiveTimestamp: number; // Last active timestamp
}
```

## DomainTimeStats

Aggregated statistics for a domain:

```typescript
interface DomainTimeStats {
  domain: string;           // Domain name
  totalTimeSpent: number;   // Total time spent in milliseconds
  visitCount: number;       // Number of visits
}
```

## HourlyTimeStats

Time usage broken down by hour:

```typescript
interface HourlyTimeStats {
  hour: number;             // Hour (0-23)
  timeSpent: number;        // Time spent in milliseconds
}
```

## DailyTimeStats

Complete usage statistics for a single day:

```typescript
interface DailyTimeStats {
  date: string;             // Date in YYYY-MM-DD format
  totalTimeSpent: number;   // Total time spent in milliseconds
  domainStats: DomainTimeStats[]; // Domain-specific stats
  hourlyStats?: HourlyTimeStats[]; // Hourly breakdown
}
```

## WebsiteLimitConfig

Configuration for website usage limits:

```typescript
interface WebsiteLimitConfig {
  domain: string;           // Domain name
  dailyLimit: number;       // Daily time limit in milliseconds
  workdayLimit?: number;    // Workday-specific limit
  weekendLimit?: number;    // Weekend-specific limit
  enabled: boolean;         // Whether limit is enabled
  lastNotificationTime?: number; // Last notification timestamp
  temporaryUnlockUntil?: number; // Temporary unlock until
}
```

## LimitStatus

Enum for limit status states:

```typescript
enum LimitStatus {
  NORMAL = 'normal',       // Normal usage
  WARNING = 'warning',     // Approaching limit
  BLOCKED = 'blocked'      // Limit reached
}
```
```

4. Now, let's create the `services.mdc` file:

```markdown
# Services

TabTime uses service modules to encapsulate business logic and data manipulation functionality.

## Time Statistics Service

[src/services/timeStats.ts](mdc:src/services/timeStats.ts) - Provides functions for:

- Retrieving and processing tab usage data
- Formatting time values for display
- Aggregating statistics by domain and time period

Key functions:

```typescript
// Formats milliseconds into human-readable strings (e.g., "2 hours 30 minutes")
formatTimeSpent(ms: number): string

// Gets raw tab time records for a specific date
getTabTimeRecords(date: string): Promise<TabTimeRecord[]>

// Gets domain-specific statistics for a date
getDomainTimeStats(date: string): Promise<DomainTimeStats[]>

// Gets hourly usage breakdown for a date
getHourlyTimeStats(date: string): Promise<HourlyTimeStats[]>

// Gets complete statistics for a single day
getDailyTimeStats(date: string): Promise<DailyTimeStats>

// Gets statistics for the most recent days
getRecentDaysStats(days: number): Promise<DailyTimeStats[]>
```

## Website Limits Service

[src/settings/website-limits.ts](mdc:src/settings/website-limits.ts) - Manages website usage limits:

- Retrieving and storing limit configurations
- Adding, updating, and removing limits
- Checking if a domain has reached its limit

Key functions:

```typescript
// Gets all website limit configurations
getWebsiteLimits(): Promise<WebsiteLimitConfig[]>

// Saves website limit configurations
saveWebsiteLimits(limits: WebsiteLimitConfig[]): Promise<void>

// Adds or updates a specific website limit
addOrUpdateWebsiteLimit(limit: WebsiteLimitConfig): Promise<void>

// Removes a website limit
removeWebsiteLimit(domain: string): Promise<void>
```
```

5. Finally, let's create the `project-structure.mdc` file:

```markdown
# Project Structure

TabTime is organized into the following directory structure:

## Key Directories

- **entrypoints/** - Contains browser extension entry points
  - **background.ts** - Background script
  - **content.ts** - Content script
  - **options/** - Options page
  - **sidepanel/** - Sidepanel UI

- **src/** - Core source code
  - **types/** - TypeScript type definitions
  - **services/** - Business logic services
  - **settings/** - Settings management
  - **block/** - Website blocking page

- **public/** - Static assets
  - **icon/** - Extension icons

## Configuration Files

- [wxt.config.ts](mdc:wxt.config.ts) - WXT (Web Extension Toolkit) configuration
- [package.json](mdc:package.json) - Project dependencies and scripts
- [tsconfig.json](mdc:tsconfig.json) - TypeScript configuration

## Build Scripts

The project uses [WXT](https://wxt.dev/) (Web Extension Toolkit) for development and building. Key npm scripts:

- `npm run dev` - Development mode for Chrome
- `npm run dev:firefox` - Development mode for Firefox
- `npm run build` - Build for Chrome
- `npm run build:firefox` - Build for Firefox
- `npm run zip` - Package the extension for Chrome
- `npm run zip:firefox` - Package the extension for Firefox
```

# Browser Extension Entry Points

Browser extensions have multiple entry points for different contexts. Here's how TabTime is structured:

## Background Script

[background.ts](mdc:entrypoints/background.ts) - The main background script that:
- Tracks active tab time
- Records usage statistics
- Manages website time limits
- Handles blocking when limits are reached

This script runs continuously in the background while the browser is open, even when the extension UI is not visible.

## Options Page

The options page provides a full dashboard experience:
- [options/index.html](mdc:entrypoints/options/index.html) - HTML entry point
- [options/main.tsx](mdc:entrypoints/options/main.tsx) - React bootstrapping
- [options/App.tsx](mdc:entrypoints/options/App.tsx) - Main component with dashboard UI

The options page is accessed by right-clicking the extension icon and selecting "Options" or through the browser's extension management page.

## Sidepanel

The sidepanel provides quick access to stats without leaving the current page:
- [sidepanel/index.html](mdc:entrypoints/sidepanel/index.html) - HTML entry point
- [sidepanel/main.tsx](mdc:entrypoints/sidepanel/main.tsx) - React bootstrapping
- [sidepanel/App.tsx](mdc:entrypoints/sidepanel/App.tsx) - Main component with simplified UI

The sidepanel is accessed by clicking the extension icon in the browser toolbar.

## Content Script

[content.ts](mdc:entrypoints/content.ts) - A minimal content script that runs in the context of web pages to provide additional functionality if needed.


# TabTime Browser Extension: Project Overview

TabTime is a browser extension that tracks and analyzes your browser tab usage time, similar to iOS Screen Time. It helps users monitor their web browsing habits and set usage limits for specific websites.

## Main Components

- **Background Script**: [background.ts](mdc:entrypoints/background.ts) - Runs in the background to track tab activity and time spent
- **Sidepanel UI**: [sidepanel/App.tsx](mdc:entrypoints/sidepanel/App.tsx) - Provides quick access to usage statistics
- **Options Page**: [options/App.tsx](mdc:entrypoints/options/App.tsx) - Full dashboard for viewing detailed statistics and configuring website limits
- **Block Page**: [block/index.html](mdc:src/block/index.html) - Shown when a user reaches their time limit for a website

## Core Features

1. **Tab Time Tracking**: Records time spent on each website
2. **Usage Analytics**: Visualizes browsing habits with charts and statistics
3. **Website Limits**: Allows setting daily time limits for specific websites
4. **Block Functionality**: Restricts access to websites once limits are reached

## Technology Stack

- Built with [WXT](https://wxt.dev/) - Web Extension Toolkit
- React for UI components
- TypeScript for type safety
- ECharts for data visualization


# Project Structure

TabTime is organized into the following directory structure:

## Key Directories

- **entrypoints/** - Contains browser extension entry points
  - **background.ts** - Background script
  - **content.ts** - Content script
  - **options/** - Options page
  - **sidepanel/** - Sidepanel UI

- **src/** - Core source code
  - **types/** - TypeScript type definitions
  - **services/** - Business logic services
  - **settings/** - Settings management
  - **block/** - Website blocking page

- **public/** - Static assets
  - **icon/** - Extension icons

## Configuration Files

- [wxt.config.ts](mdc:wxt.config.ts) - WXT (Web Extension Toolkit) configuration
- [package.json](mdc:package.json) - Project dependencies and scripts
- [tsconfig.json](mdc:tsconfig.json) - TypeScript configuration

## Build Scripts
The project uses [WXT](mdc:https:/wxt.dev) (Web Extension Toolkit) for development and building. Key npm scripts:

- `npm run dev` - Development mode for Chrome
- `npm run dev:firefox` - Development mode for Firefox
- `npm run build` - Build for Chrome
- `npm run build:firefox` - Build for Firefox
- `npm run zip` - Package the extension for Chrome
- `npm run zip:firefox` - Package the extension for Firefox


# Services

TabTime uses service modules to encapsulate business logic and data manipulation functionality.

## Time Statistics Service

[src/services/timeStats.ts](mdc:src/services/timeStats.ts) - Provides functions for:

- Retrieving and processing tab usage data
- Formatting time values for display
- Aggregating statistics by domain and time period

Key functions:

```typescript
// Formats milliseconds into human-readable strings (e.g., "2 hours 30 minutes")
formatTimeSpent(ms: number): string

// Gets raw tab time records for a specific date
getTabTimeRecords(date: string): Promise<TabTimeRecord[]>

// Gets domain-specific statistics for a date
getDomainTimeStats(date: string): Promise<DomainTimeStats[]>

// Gets hourly usage breakdown for a date
getHourlyTimeStats(date: string): Promise<HourlyTimeStats[]>

// Gets complete statistics for a single day
getDailyTimeStats(date: string): Promise<DailyTimeStats>

// Gets statistics for the most recent days
getRecentDaysStats(days: number): Promise<DailyTimeStats[]>
```

## Website Limits Service

[src/settings/website-limits.ts](mdc:src/settings/website-limits.ts) - Manages website usage limits:

- Retrieving and storing limit configurations
- Adding, updating, and removing limits
- Checking if a domain has reached its limit

Key functions:

```typescript
// Gets all website limit configurations
getWebsiteLimits(): Promise<WebsiteLimitConfig[]>

// Saves website limit configurations
saveWebsiteLimits(limits: WebsiteLimitConfig[]): Promise<void>

// Adds or updates a specific website limit
addOrUpdateWebsiteLimit(limit: WebsiteLimitConfig): Promise<void>

// Removes a website limit
removeWebsiteLimit(domain: string): Promise<void>
```