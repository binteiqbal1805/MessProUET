#task 1
colours = {"orange","pink","black","golden"}
colours.update({"blue","zink"})
colours.remove("pink")
print(colours)
 #task 2
set_1 = {1,2,3,4}
set_2 = {3,4,5,6}
set_3 = set_1.union(set_2)
print(set_3)
set_4 = set_1.intersection(set_2)
print(set_4)
set_5 = set_1.difference(set_2)
print(set_5)
set_6 = set_1.symmetric_difference(set_2)
print(set_6)
 #task 3
animals = {"lion","cat","dog","goat","rabbit","cow"}
user = input("Enter the name of an animal :")
if user in animals :
    print("your animal is in my set")
else :
    print("the aminal is not in my set")
car= {"brand":"Ford","model":"Mustang","year":1964}
print(car.get("model"))
car["year"] = 2021
print(car)
car["color"] = "red"
print(car)
car.pop("model")
print(car)
a ={1:"Ayesha",2:"Zainab",3:"Tasbiha",4:"Munazza"}
b = {1:"areej",2:"Tasbiha",4:"ali"}
for i in a:
    if i in b:
        print("true")
        break
'''Lab '''
#Task 4
countries = {"Pakistan":"Islamabad","Afghanistan":"Kabul","India":"New Delhi"}
capital =countries.values()    
print(capital)
#Task 5
movies = {"The Dark Night":2008,"Moana":2023,"Neelofar":2025}
movies["Dancing princess"] = 2008
movies["Moana"]=2021
print(movies)
#Task 6
words ={"fetch":"to bring","Ubiquitous":"Present","Diligent":"earnest","Plausible":"beleivable","cozy":"Warmth"}
del words["fetch"]
words.pop("Ubiquitous")
print(words)
#Task 7
subjects = {"AICT":23,"Calculus":26,"PF":25,"AP":31}
print(subjects.keys())
print(subjects.values())
print(subjects)
value=subjects["Calculus"]
p