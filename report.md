# Backend k6 Load Test Report

**Date:** 2026-11-02  
**Status:** Not run: backend could not be started in this environment.

## Setup

- Created a local-only `.env` using `mongodb://127.0.0.1:27018/lgacertificate_loadtest` and placeholder development secrets. It contains no production credentials and is excluded by `.gitignore`.
- Installed the locked project dependencies and ran `pnpm build`; TypeScript compilation completed successfully.
- k6 2.3.0 is installed.
- No application or MongoDB service was running when setup began.

## Why there are no k6 results

The backend waits for MongoDB before it starts listening. A temporary MongoDB instance was attempted with a 0.25 GiB WiredTiger cache, first on port 27017 and then on port 27018. Both attempts failed during socket binding with `Address already in use`; the sandbox also initially denied socket operations. No backend process became available to test, so k6 was not run. No request counts, latency figures, or capacity claims are reported.

## Resource observations

- Before setup: approximately 5.4 GiB RAM available; approximately 4.7 GiB swap in use.
- After dependency installation/build and MongoDB startup attempts: approximately 5.0 GiB RAM available; approximately 4.5 GiB swap in use.
- MongoDB was configured with a 0.25 GiB cache. The test was stopped when the backend could not be started; no load workload was launched.

## To complete the test

Start a test MongoDB instance on the port configured in `.env` (27018), then start the backend and run a staged k6 test against `GET /api/v1/states`. Begin with a small smoke test, monitor available RAM and swap, and increase traffic only while resource use stays safe. That endpoint exercises the HTTP/API path without creating application records or calling external payment, mail, or storage services. This local test would not by itself establish production capacity because hardware, MongoDB topology, and external services differ.
