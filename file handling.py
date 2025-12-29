f=open("student.txt","w")
f.write("ID:1,Name:Ayesha,Age:18\n")
f.write("ID:2,Name:Tasbiha,Age:18\n")
f.write("ID:3,Name:Areej,Age:18\n")
f.write("ID:4,Name:Zainab,Age:18\n")
f.write("ID:5,Name:Munazza,Age:18\n")
f.close()
f=open("student.txt","r")
data = f.read()
print(data)
f.close()
f=open("student.txt","r")
stdID =input("Enter student ID")
for line in f:  
    if stdID in line:
        print(line) 
f.close()    

stID = input("Enter student id whose age is to be updated")
age = input("Enter new age")
f=open("student.txt","r")
lines = f.readline()
f.close()
f=open("student.txt","w")
for line in lines:
    x = line.strip().split(",")
    if x[0] == stID:
        x[2] = age
f.close()
print("Record Updated") 
user = input("Enter student id")
data = ""
with open("student.txt","w") as f:
    if user not in f:
        data += line
with open("student.txt","w") as f:
    f.write(data) 
file = ""        
with open("student.txt") as f:
    










