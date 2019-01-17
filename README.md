# url-shortener-api

## Build Docker image
```
yarn build:docker
```

### Starting
See [url-shortener-frontend](https://github.com/eduardobcastro/url-shortener-frontend)

## How are URLs generated?
- An SHA1 hash of the URL is generated (eg: https://www.google.com = ef7efc9839c3ee036f023e9635bc3b056d6ee2db)
- First we try to use just one character as the URL code ("e")
- If there is already an URL with the code "e" then we check whether the found URL is https://www.google.com
- If the found URL is https://www.google.com then we return the code "e"
- If the found URL is different from https://www.google.com then we need to use another code, so we append the next hash character ("f") to the code and search again
- If we cannot find any URL then we return the not found code
