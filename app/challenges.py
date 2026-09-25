"""
Challenge text per card, generated from challenges.csv.

Do not edit by hand - run `python -m scripts.import_challenges` instead.
Cards are in deck order (GEMEENTES, then WILD_CARDS) and every card in
the deck has an entry, so an empty title, description or link means the
sheet itself is still empty there.
"""

from typing import Dict

from app.game_data import Challenge

CHALLENGES: Dict[str, Challenge] = {
    'Aalten': Challenge(
        title='',
        description='',
        link='',
    ),
    'Almelo': Challenge(
        title='Find something to do',
        description='Film a traffic light changing to red, and then within 10 seconds a different traffic light changing to green.',
        link='https://youtu.be/63f2xQTuQ3g',
    ),
    'Apeldoorn': Challenge(
        title="Get Deutsche Bahn'ed",
        description='Travel on a delayed train. Only person has to travel by train.',
        link='',
    ),
    'Arnhem': Challenge(
        title='Be your own DSO',
        description='Power a light next to a MSR. Your solution needs to have a power source, some way of transmitting power, and a standard bulb as the light. You may not use any cables or power banks you already have with you.',
        link='',
    ),
    'Barneveld': Challenge(
        title='',
        description="Barneveld is famous for its chicken, but also for the darts player Raymond van Barneveld. Go near a place in Barneveld that has chicken (real chicken, dead or alive) or eggs. One of you will become Raymond, a precise thrower, they will be handed a ball and put on a blindfold. The other two players are the chicken, they walk around Raymond in circles (at a steady pace, don't stand still) at a distance of at least 5m while making chicken sounds. Raymond then gets 10 attemps to shoot his dart (ball) at both of the chicken. If Raymond does not succeed (that is, hits both of the chicken) in 10 tries, someone else becomes Raymond and the new Raymond tries again.",
        link='',
    ),
    'Berkelland': Challenge(
        title='',
        description='Berkelland was named after the Berkel, which was used as a major shipping route between Germany and the Netherlands. The river was crossed using the so called Berkelzompen. Honor this tradition by going to the Berkel anywhere within Berkelland and go on to build your own Berkelzomp. Create a paper boat, that is able to float on the Berkel for at least 10 seconds.',
        link='',
    ),
    'Borne': Challenge(
        title='',
        description='Go to the Openluchttheater Hertme and recognize a song by Ilse de Lange. Look up the playlist "This is Ilse de Lange", and put it on shuffle. Guess the title of the song in 1 try. If you get it wrong, you have to listen to the whole song and can retry at the next song.\nBackground: I would\'ve placed this challenge in Almelo since that\'s more iconic for Ilse but Dany beat me to it.',
        link='https://metropool.nl/agenda/ilse-delange',
    ),
    'Bronckhorst': Challenge(
        title='',
        description='In the semifinals of the men\'s soccor world championship, Giovanni van Bronckhorst scored his furthest goal ever, from 37 meter, which helpen us beat Uruguay 3-2. Find a goal that is unmistakenly used to play soccer. Each team member must score their own Van Bronckhorst "Magical Goal" from a distance of 37 meters. https://www.youtube.com/watch?v=JVQmWZoNHG4',
        link='',
    ),
    'Brummen': Challenge(
        title='',
        description="Of course we all know Brum, and since we're in Brummen (multiple), you're challenge is simple: find three parked yellow cars.",
        link='',
    ),
    'Dalfsen': Challenge(
        title='',
        description='Get a perfect score on 30 seconds. Go the site below and use the standard difficulty. Take turns explaining the words to your teammates. Keep going until you get 5/5 words on a turn. You are not allowed to skip turns.',
        link='https://30secondenspel.nl/',
    ),
    'Deventer': Challenge(
        title='',
        description='You\'re in the snackzone! Get yourself some Deventerse "Bijtjes" and review them snackzone style. Make sure you edit a nice banner of course and send the video in the group chat. (p.s. since not everyone is a burger with corresponding money yet, you are allowed to find original bijtjes, take a photo with them, and then do the challenge with a cheaper alternative)',
        link='',
    ),
    'Dinkelland': Challenge(
        title='',
        description='In 2018 Dinkelland was named the safest municipality of the Netherlands, much has changed in 8 years. Prove how unsafe Dinkelland is. Find 5 different triangular warning signs and take a picture of each one. Each sign must show a different warning.',
        link='',
    ),
    'Doesburg': Challenge(
        title='',
        description="Doesburg has the oldest weighhouse in NL (De Waag from 1478), so let's see how good you are at weighing! Put a blindfold on 1 of your teammates. Take 2 identical full water bottles, take ONLY 2 sips out of one bottle, shuffle them, and place 1 in each hand. Holding arms straight out, the scale must guess which bottle is heavier. The scale must get it right 3 times in a row.",
        link='',
    ),
    'Doetinchem': Challenge(
        title='',
        description='Doetinchem created the DOS (Doetinchem en OntwikkelingsSamenwerking) with its sister cities La Libertad in Nicaragua and Pardubice in the Czech Republic.\n\nNow create your own DOS: Dribble, Obstacle, Score!\n\nFind an object starting with D and Dribble it past an Obstacle starting with O, then Score by getting it into a goal made from something starting with S.\n\nFor example: dribble a Door past an Octopus and score in a goal made of Solar panels.\n\nFilm your attempt from start to finish.',
        link='',
    ),
    'Duiven': Challenge(
        title='',
        description='Capture duiven in Duiven. Take a picture of two or more pigeons in the same photo. The pigeons must be at most 5 meters away from you, and two pigeons at most 5 meters apart.',
        link='',
    ),
    'Ede': Challenge(
        title='',
        description='Play "Ede of Epe". Go to a sign that says \'Welkom in Ede\' or \'Gemeente Ede verwelkomt u\', or similar (you may park at a safe distance from it, but get as close to the sign as possible). One teammate Googles either Ede or Epe randomly (use a die or something) and read out a statement, news article headline, etc. For example: "Gemeente Ede or Epe has 125.000 inhabitants". The other teammates must guess which one it is. Play this game for 4 rounds, you must get 3 correct. If you fail, you must go to another \'Welkom in Ede\' sign to play another 4 rounds. You may not do research beforehand. You also may not switch roles. If you have done this challenge in Epe, stick to the same roles.',
        link='',
    ),
    'Elburg': Challenge(
        title='',
        description='',
        link='',
    ),
    'Enschede': Challenge(
        title='',
        description='PLOP! Enschede is where Grolsch is brewed with its iconin plopping bottle caps. Each team member must perform 1 unique way to create a PLOP sound.',
        link='',
    ),
    'Epe': Challenge(
        title='',
        description='Play "Ede of Epe". Go to a sign that says \'Welkom in Epe\' or \'Gemeente Epe verwelkomt u\', or similar (you may park at a safe distance from it, but get as close to the sign as possible). One teammate Googles either Ede or Epe randomly (use a die or something) and read out a statement, news article headline, etc. For example: "Gemeente Ede or Epe has 34.000 inhabitants". The other teammates must guess which one it is. Play this game for 4 rounds, you must get 3 correct. If you fail, you must go to another \'Welkom in Epe\' sign to play another 4 rounds. You may not do research beforehand. You also may not switch roles. If you have done this challenge in Epe, stick to the same roles.',
        link='',
    ),
    'Ermelo': Challenge(
        title='',
        description='',
        link='',
    ),
    'Haaksbergen': Challenge(
        title='',
        description='',
        link='',
    ),
    'Hardenberg': Challenge(
        title='',
        description='Did you know Hardenberg has almost 50 churches? Go to a church and guess when it was built. You can be a maximum of 100 years of. If you fail, find a different church',
        link='',
    ),
    'Harderwijk': Challenge(
        title='',
        description='In the Dutch TV series *Het Klokhuis*, Aart Staartjes played a professor in several sketches: Professor Fetze Alsvanouds, who claimed to hail from the prestigious “University of Harderwijk.” The only problem? Harderwijk hasn’t had a university since 1811! Nevertheless professor Fetze Alsvanouds needs your help to prove a theory: The higher you are the faster you can eat an apple!\nTake a picture where one of you is higher than the other and has an apple fully eaten with only *Het Klokhuis* (the core) remaining while the lower person is still busy eating their apple.',
        link='',
    ),
    'Hattem': Challenge(
        title='',
        description='Hattem is home of the one and only museum fully dedicated to Anton Pieck! As you know, Anton Pieck is behind the designs of a lot of the art of the fairy tales in the Efteling! Go to the Anton Pieck museum, and act out (without talking) different fairy tales that can be found in the Sprookjesbos. Have strangers guess the fairy tale. You have completed the challenge when 5 different strangers have guessed a fairy tale.',
        link='',
    ),
    'Heerde': Challenge(
        title='',
        description='Ach heerde, heerde is truly heerdelijk. Known for its nature, hiking paths and recreational possibilities it is the perfect place to take a bit of a break from all the stressful, fast paced challenges and touch some grass. Sit down together and stay entirely silent for at least 5 minutes. You must gauge yourself how long that is, without consulting a timer. If you end up speaking before the 5 minutes are over you can try again immediately.',
        link='',
    ),
    'Hellendoorn': Challenge(
        title='Have fun in Hellendoorn',
        description='This place is "famous" for the equally named adventure park. Find a fun place and have fun for 15 minutes. You are not allowed to strategize during this time.',
        link='',
    ),
    'Hengelo': Challenge(
        title='',
        description='Hengelo is the very last station many germans see before crossing the border with Deutsche Bahn. Because of that there is also a lot of german tourists, that are looking for sights. Two members must be able to spell some of the common sights that a tourist might look for in german. In total they must spell 5 words correctly. When they spell one word wrong they must wait 1 minute before attempting to spell another one. Nina is obviously not allowed to be one of the spelling people. A list of suitable sights/words can be found on the next sheet',
        link='',
    ),
    'Hof van Twente': Challenge(
        title='Find Twents',
        description='Find a sign exclusively written in the Twents dialect, and translate it successfully to English. If you fail you can try again with a different sign.',
        link='',
    ),
    'Kampen': Challenge(
        title='',
        description="Time to go kamperen! Build a 'tent'. The tent must stand on its own for at least 10 seconds and fit at least one person lying down! Your tent does not need any doors or floors.",
        link='',
    ),
    'Lochem': Challenge(
        title='',
        description='One of the things that can be found in Lochem is de dikke boom van Verwolde. This oak tree is estimated to be around 700 years old, what a long way for a tree to stand. All the members in your team must form a forest by holding the tree yoga position together for two consecutive minutes. If one of you fails you must try again.',
        link='',
    ),
    'Losser': Challenge(
        title='',
        description='It\'s time to get the hips a little Losser :) or even better, let\'s get Footloose! Learn the dance from Dirt Road Dancing on YouTube. When you all think you\'ve got it down, dance flawlessly to \'Footloose - "From Footloose"\' for the first couplet and chorus of the song.',
        link='',
    ),
    'Montferland': Challenge(
        title='',
        description='',
        link='',
    ),
    'Nijkerk': Challenge(
        title='',
        description='',
        link='',
    ),
    'Nunspeet': Challenge(
        title='',
        description="Charlotte's aunt and uncle are from Nunspeet and they love to do GeoCaches. Find a GeoCache.",
        link='',
    ),
    'Oldebroek': Challenge(
        title='',
        description='',
        link='',
    ),
    'Oldenzaal': Challenge(
        title='',
        description='Did you know that Carlos Platier Luna, the winner of Expeditie Robinson 2017 is from Oldenzaal? To celebrate this, go to a playground and perform an Expeditie Robinson proef: one teammate hangs from a bar without touching the floor for one full minute. If you fail, you may try again after 10 minutes. You may not practice.',
        link='',
    ),
    'Olst-Wijhe': Challenge(
        title='',
        description='Olst-Wijhe is home to De IJssellinie, a top-secret 50s Cold War defense line filled with bunkers along the IJssel. Troops in observation posts had to transmit secret intel in a way so the Soviets would not be able to intercept them. And the ideal way to do this is charades (hints)!\n\nStand 30 meters apart in an open area in Olst-Wijhe. Teammate 1 acts out a secret word they think of using only their body. Teammates 2 and 3 stand 30 meters away and must shout out the correct answer. Each teammate has to act out one secret word.',
        link='',
    ),
    'Ommen': Challenge(
        title='',
        description='Ommen is a popular tourist destination, famous for its campsites and bungalow parks. But it is also home to a unique piece of Dutch cultural heritage: the National Tin Figure Museum.\nThe museum brings history to life using tiny tin figures, depicting everything from large-scale battles to intricate everyday scenes.\nYour challenge: create your own diorama!\n\nYour scene must:\nContain at least 3 clearly humanoid characters.\nShow the characters doing something together.\nInclude at least 2 objects that the characters are interacting with or using.\nBe entirely handcrafted from whatever materials you can find.\n\nOnce your masterpiece is complete, take a picture of your diorama as proof of your artistic achievement!',
        link='',
    ),
    'Oost Gelre': Challenge(
        title='Adt Grolsch in Grolle',
        description='Honour the origin of Grolsch by adting a (0.0%) beer of at least 33cl.',
        link='',
    ),
    'Oude IJsselstreek': Challenge(
        title='',
        description='',
        link='',
    ),
    'Putten': Challenge(
        title='',
        description='Dig a put (aka a well). The put must be at least 10 cm deep and at least 10 cm in diameter. Fill the put with at least 500 ml of water.',
        link='',
    ),
    'Raalte': Challenge(
        title='',
        description='',
        link='',
    ),
    'Renkum': Challenge(
        title='',
        description="What's a famous monument of Renkum? The Renkum windmill of course. Build a 'windmill' yourself! What would this look like? It doesnt matter, as long as it can spin at least 5 times through windpower alone (blowing it is obviously allowed)",
        link='',
    ),
    'Rheden': Challenge(
        title='',
        description='',
        link='',
    ),
    'Rijssen-Holten': Challenge(
        title='',
        description='Don\'t you also love reizen and hollen? When travelling, you often end up in a different time zone. Play "It\'s five o\'clock somewhere", one teammate generates times that it is around the world, the other two teammates guess where it is that time. You get six tries an must get at least three correct. If you don\'t get three correct guesses, you must wait 12 minutes to try again. Alternatively, if you don\'t want to wait 12 minutes, you can also choose to go \'hollen\': have one teammate run 1km. You may not study. After a failed attempt, so after the full 6 guesses, the actual times of your incorrect guesses may be revealed.',
        link='',
    ),
    'Rozendaal': Challenge(
        title='',
        description='Rozendaal is one of the wealthiest municipalities in the Netherlands, with the third-highest concentration of millionaires in the country. Of course, you want to be rich too!\nYour challenge: become a millionaire. Find a local resident, confess your love to them, and offer them a rose. They must accept the rose without you explaining that it is a challenge. Take a picture of the romantic moment as proof.',
        link='',
    ),
    'Scherpenzeel': Challenge(
        title='',
        description="(Re)build a livable city. Go to the statue of three men carrying wood in the center of Scherpenzeel. Just like they are rebuilding what was once destroyed, two of you will build a city. Use only items you find around you and not more than 3 items from your bag, you must build a house, church, school, hospital and a shop. The third teammate must then correctly guess which building is which. If they guess incorrectly, you may try again after 10 minutes, but with 3 different items then before. Some rules: if, hypothethically, you use teammate #1's water bottle as one of the items, you may not use teammate #2's water bottle in a second try, those would be the same item. Furthermore, you may not prepare for this challenge by packing something for it.",
        link='https://standbeelden.vanderkrogt.net/object.php?record=GL45ab',
    ),
    'Staphorst': Challenge(
        title='',
        description="Vindt een 'levensboom', dat hangt in Staphorst boven een deur als er nog een vrijgezelle dochter woont. TODO",
        link='',
    ),
    'Steenwijkerland': Challenge(
        title='',
        description='',
        link='',
    ),
    'Tubbergen': Challenge(
        title='',
        description='',
        link='',
    ),
    'Twenterand': Challenge(
        title='',
        description='',
        link='',
    ),
    'Voorst': Challenge(
        title='',
        description='',
        link='',
    ),
    'Wageningen': Challenge(
        title='',
        description='Help de agrarische sector; plant een kastanje.',
        link='',
    ),
    'Westervoort': Challenge(
        title='',
        description="You all know our great friends Lucy Westerweel and Sven van der Voort. If you mix their last names, you get Westervoort. Speaking of mixing, do you like cocktails? Charlotte is sad she didn't get to do the cocktail challenge last time so here it is again:",
        link='',
    ),
    'Wierden': Challenge(
        title='',
        description='',
        link='',
    ),
    'Winterswijk': Challenge(
        title='',
        description="This might be too similar to Scott's challenge for Ommen I realized after making it -> Mondriaan spent his youth in Winterswijk. Create a Mondriaan artwork. All materials must be gathered on location (e.g. leaves, twigs, stones); you may not use any items you already had with you. Construct a grid with at least one red, one yellow and one blue item. Take a photo and send it in the group chat as proof.",
        link='',
    ),
    'Zevenaar': Challenge(
        title='',
        description="Find a tossable piece of food and stand at least 4? (I don't know what number is realistic) metres apart.\nYour challenge: toss the food directly into your teammate’s mouth 7 times!\nThe food must go straight from the thrower’s hand into the catcher’s mouth, and you must remain at least 3 metres apart for every attempt.\nRecord the entire challenge on video as proof.",
        link='',
    ),
    'Zutphen': Challenge(
        title='',
        description='',
        link='',
    ),
    'Zwartewaterland': Challenge(
        title='',
        description='Genemuiden in Zwartewaterland is the Netherlands\' "Carpet Capital" (Tapijtstad). Place a big cloth like a towel or picnic blanket (carpet ;)) on the ground. 2 teammates stand on it while the third pulls the carpet 5 meters. The teammates on the carpet may never touch the ground. If they do, restart from 0m!',
        link='',
    ),
    'Zwolle': Challenge(
        title='',
        description='Welcome to Zwollywood! Go to a movie theater and play "Finish the famous movie line" from this BuzzFeed quiz. You must do them in order and wait 30 seconds between guesses. If you fail completely, look up another quiz :)',
        link='https://www.buzzfeed.com/kaylayandoli/finish-famous-movie-quotes-quiz',
    ),
    'Pieterpad Wild Card': Challenge(
        title='',
        description='The Pieterpad is indicated by white and red markings along the path. Start from one of these markings and choose a direction to go into. Follow the Pieterpad with at least two teammembers until you have seen markings at 7 different cross-roads*.  If at any point during this challenge one of the team members takes a wrong turn, the challenge is failed. You may retry in a different gemeente. \n*At some cross-roads you may find multiple signs that indicate both the correct and incorrect road to take, those count as one.',
        link='',
    ),
    'Nationale parken Wild Card': Challenge(
        title='',
        description='',
        link='',
    ),
    'Burger King Wild Card': Challenge(
        title='',
        description='Go to a Burger King, leave one teammate blindfolded outside. The other two team member order a burger randomly (use a random number generator). The burger may come from the whole menu, but it must be a burger. The blindfolded person must then taste the burger and recognise which one it is. They may consult the ordering machine inside. They have one guess. If the guess is incorrect, you can try again in a different Burger King.',
        link='',
    ),
    'Station Wild Card': Challenge(
        title='',
        description="With this card, you don't only earn a gemeente, but you can connect two clusters that were not connected before, kind of like the station in Ticket to Ride. Have one team member get on the train in a gemeente that is yours. That person rides the train to a different gemeente that is not yours yet. After picking the teammate up, the two gemeentes (which are not physically connected to each other) are now connected for you.",
        link='',
    ),
    'Intratuin Wild Card': Challenge(
        title='',
        description='',
        link='',
    ),
    'Kinderboerderij Wild Card': Challenge(
        title='',
        description='Today is Animalday! Go to a kinderboerderij. One of the teammembers must find an animal and sculpt it in butter. The other teammates must succesfully guess which animal was sculpted. If you fail, you can only retry this in a different gemeente.',
        link='',
    ),
}
