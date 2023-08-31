# LiveSync Subscribe Publish

A static-site-generator runner for Self-hosted LiveSync.

Subscribe to the changes of the remote database of Self-hosted LiveSync, fetch them on the local filesystem, and run the script if the specific file has been changed!

a.k.a. (Currently) Subscribe only Filesystem-LiveSync.

## Prerequisite

- Deno required.
- This should be running near or at the same place where your CouchDB has been hosted.
  Probably uses a lot of traffic.

## How to run

```sh
$ git clone --recursive https://github.com/vrtmrz/livesync-subscribe-publish
$ cd livesync-subscribe-publish
$ cp config.sample.json config.json
$ vi config.json
$ deno run -A main.ts
```

## Configuration

```jsonc
{
  "database": "test", // Name of your database
  "passphrase": "passphrase", // Passphrase for E2EE. If you are not using it, leave it empty.
  "password": "password", // Password for CouchDB
  "url": "http://localhost:5984",
  "username": "admin",
  "customChunkSize": 100, // keep as is.
  "minimumChunkSize": 20, // keep as is.
  "obfuscatePassphrase": "passphrase", // If you are obfuscating the path, please set the same as a passphrase. If you are not using it, leave it empty.
  "baseDir": "blog/", // `blog` folder of your vault would be subscribed.
  "localDir": "sitesrc/", // Subscribed files will be stored into `sitesrc/`. Please use posix format.
  "script": {
    "cmd": "cmd", // a programme which you want to run
    "args": [
      // and arguments.
      "/C",
      "script\\test.bat"
    ]
  },
  "keyfile": "flush.md" // `cmd` would be run when `flush` has been modified.
}
```
