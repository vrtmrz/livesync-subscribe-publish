# LiveSync Subscribe Publish

A static-site-generator runner for Self-hosted LiveSync.

Subscribe to the changes of the remote database of Self-hosted LiveSync, fetch them on the local filesystem, and run the script if the specific file has been changed!

a.k.a. (Currently) Subscribe only Filesystem-LiveSync.

## Prerequisite

- Deno required.
- If you want to use watch mode (default), this should be running near or at the same place where your CouchDB has been hosted.
  Probably uses a lot of traffic.
- If you are going to USE API update mode, traffic would be a more reasonable amount.
  Unset `keyfile` and set `apiPath` please.

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
  "subscribeDir": "blog/", // `blog` folder of your vault would be subscribed.
  "localDir": "sitesrc/", // Subscribed files will be stored into `sitesrc/`. Please use posix format.
  "script": {
    "cmd": "cmd", // a programme which you want to run
    "args": [
      // and arguments.
      "/C",
      "script\\test.bat"
    ]
  },
  "resultDir": "publishresult/", // Script output will be uploaded to your vault under `publishresult`
  "keyfile": "flush.md", // `cmd` would be run when `flush` has been modified.
  "statDir": "dat/", // Status file dir.
  "publishDir": "../hugosite/public", // Hosting dir
  "publishPort": 8080, // Hosting port for API and/or static files
  "apiPath":"" // API Path
  "useV1":false // If you are using V1 in Self-hosted LiveSync, you have to set this to true.
}
```


## Tips
[obsidian-export](https://github.com/zoni/obsidian-export) and [Hugo](https://gohugo.io/) could be nice friends.  
[LiveSync-Subscribe-Publish-Kit](https://github.com/vrtmrz/livesync-subscribe-publish-kit) is the integrated sample.