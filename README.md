# bcnode-hybrid
Build the new image using something like this:

```
docker build -t "blockcollider/bcnode:0.7.7-mpxc" .
```

Afterwards, run it as usual:

```
docker run --name bcnode -p 3000:3000 blockcollider/bcnode:0.7.7-mpxc start --ws --rovers --ui --node --miner-key <YOUR-KEY>
```
