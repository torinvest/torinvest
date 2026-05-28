<?php
header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *"); 

$address = "d572538e2ddbc02611f9ab5033be81b17cb4fcb7756865742523861ca320b107";

$api = "https://ironfish.herominers.com/api/stats_address?address=" . $address;

echo file_get_contents($api);
