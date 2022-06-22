import './App.css';
import { useEffect, useState } from 'react'
import nextThursday from 'date-fns/nextThursday';
import format from 'date-fns/format';

import { initializeApp } from 'firebase/app';
import { getAnalytics } from "firebase/analytics";
import { getDatabase, ref, set, get, remove, child, onValue } from "firebase/database";

import {
  signInWithPopup,
  GoogleAuthProvider,
  getAuth,
  signInWithEmailAndPassword,
  browserLocalPersistence,
  onAuthStateChanged,
  setPersistence,
  createUserWithEmailAndPassword,
  signOut,
} from 'firebase/auth'

const provider = new GoogleAuthProvider();

const firebaseConfig = {
  apiKey: "AIzaSyAIEdwCodUThQeZQd5pMfRNu9k5yeWtyvg",
  authDomain: "mv-football.firebaseapp.com",
  projectId: "mv-football",
  storageBucket: "mv-football.appspot.com",
  messagingSenderId: "1062356418564",
  appId: "1:1062356418564:web:20dea6a745df85d8c37551",
  measurementId: "G-B234KC5YHW",
  databaseURL: "https://mv-football-default-rtdb.europe-west1.firebasedatabase.app",
};


const app = initializeApp(firebaseConfig);
const auth = getAuth();
const analytics = getAnalytics(app);
const nextGameDay = nextThursday(new Date())
const nextGame = format(nextGameDay, 'yyyyMMdd')

/*
 *  App
 */
function App() {
  const [user, setUser] = useState();
  const [attends, setAttends] = useState(false)
  const [keyedAttendees, setKeyedAttendees] = useState([])
  const [attendees, setAttendees] = useState([])
  const [showAttendees, setShowAttendees] = useState(false)
  const [showNeedsLogin, setShowNeedsLogin] = useState(false)
  const [usersList, setUsersList] = useState({})

  useEffect(() => {
    init(auth, setUser)
  }, [])

  useEffect(() => {
    document
      .querySelector('meta[name="theme-color"]')
      .setAttribute("content", attends ? '#283148' : '#711515');
  }, [attends])

  useEffect(() => {
    if (!user) {
      setAttends(false);
    } else {
      getUsersList(setUsersList)
      getStatus(user.uid, val => {
        setAttends(val);
        getAttendees(att => {
          setKeyedAttendees(att);
          setAttendees(
            Object.keys(att)
              .filter(a => att[a].timestamp)
              .map(a => ({ ...att[a], uid: a }))
              .sort((a, b) => a.timestamp - b.timestamp)
          )
        }, (e) => {
          console.log(e)
        })
      }, () => {})
    }
  }, [user])

  function toggleAttendance() {
    if (user) {
      if (attends) {
        leaveGame(user.uid,  () => {}, () => {})
      } else {
        joinGame(user.uid, user.email, () => {}, () => {})
      }

      setAttends(!attends);
    } else {
      needLogin()
    }
  }

  function incrementExternal() {
    if (user && keyedAttendees[user.uid]) {
      setExternalsCount(user.uid, +(keyedAttendees[user.uid].externals || 0) + 1, () => {}, () => {});
    }
  }

  function decrementExternal() {
    if (user && keyedAttendees[user.uid] && +keyedAttendees[user.uid].externals) {
      setExternalsCount(user.uid, Math.max(+(keyedAttendees[user.uid].externals || 0) - 1, 0), () => {}, () => {});
    }
  }

  function toggleShowAttendees() {
    if (user) {
      setShowAttendees(!showAttendees)
    } else {
      setShowAttendees(false)
    }
  }

  function needLogin() {
    setShowNeedsLogin(true);
    setTimeout(() => setShowNeedsLogin(false), 500)
  }

  return (
    <>
      <div className={`App ${attends ? 'Attends' : ''}`}>
        {user && <UserMenu user={user} setUser={setUser} usersList={usersList}/>}
        <header className="AppHeader">
          <section className="UserData">
            Joi {format(nextGameDay, 'd/M/yyyy')}
            {user && <p>({getAttendeesCount(keyedAttendees)} participanti)</p>}
          </section>
        </header>

        <section className="ActionContent">
          <p>{attends ? 'Ma duc la fotbal Joi' : 'Nu ma duc la fotbal Joi'}</p>
          <button className="MaDuc" onClick={toggleAttendance}>{attends ? 'M-am razgandit' : 'Ba ma duc'}</button>
          {user &&
            <section className="Externi">
              <p>{keyedAttendees[user.uid]?.externals ? (keyedAttendees[user.uid].externals > 1 ? `Aduc si ${keyedAttendees[user.uid].externals} prieteni` : 'Aduc si un prieten') : ''}</p>
              <section className="ExterniActions">
                <button className="Extern" onClick={incrementExternal}>+1 Extern</button>
                <button className="Extern" onClick={decrementExternal}>-1 Extern</button>
              </section>
            </section>
          }
        </section>

        <div className={'Auth ' + (!user ? '' : 'WayBottom') + (showNeedsLogin ? 'Zoom' : '')}>
          <Login user={user} setUser={u => setUser(u)}/>
        </div>

        {user &&
          <section className='Attendees'>
            <section className={`${showAttendees ? '' : 'Hidden'} AttendeesList`}>
            {
              showAttendees &&
              <span onClick={toggleShowAttendees} className={`material-icons HideAttendees`}>keyboard_double_arrow_up</span>
            }
              <ul>
                { attendees.map(a =>
                  <li key={a.email}>
                    {
                      usersList[a.uid]?.p5 ?
                      <span className="Person P5 material-icons">person</span> :
                      <span className="Person material-icons">person_add</span>
                    }
                    {usersList[a.uid]?.name || a.email}
                    &nbsp;{keyedAttendees[a.uid].externals ? `(+${keyedAttendees[a.uid].externals})` : ''}
                  </li>)
                }
              </ul>
            </section>
            {!showAttendees &&
              <span onClick={toggleShowAttendees} className="material-icons">keyboard_double_arrow_down</span>}
          </section>
        }
      </div>
    </>
  );
}

/*
 *  Auth
 */
const Login = ({ location, user, setUser }) => {
  // const queryCode = (window.location.search.split('&')[0] || '').split('=')[1] || '';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  // const [invitation, setInvitation] = useState(queryCode);
  const [errorText, setErrorText] = useState('');
  const [loginSelect, setLoginSelect] = useState(true);

  function displayError(text) {
    setErrorText(text);
    setTimeout(() => setErrorText(''), 3000);
  }

  return (
    <section>
      <form id="loginForm" action='' onSubmit={(e) => signIn(e, email, password, setUser)}>
        {
          <div className="LoginInputs">
            {
              !user &&
              <section className="LoginSelect">
                <span onClick={() => setLoginSelect(false)}>{loginSelect && 'Signup'}</span>
                <span onClick={() => setLoginSelect(true)}>{!loginSelect && 'Login'}</span>
              </section>
            }
            {!user && <input
              placeholder="email"
              className="UsernameInput"
              autoComplete="username"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />}
            {!user && <input
              placeholder="parola"
              className="PasswordInput"
              autoComplete="current-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />}
            {/*{*/}
            {/*  !user && !loginSelect &&*/}
            {/*  <input*/}
            {/*    placeholder="cod invitatie"*/}
            {/*    type="text"*/}
            {/*    value={invitation}*/}
            {/*    onChange={(e) => setInvitation(e.target.value)}*/}
            {/*  />*/}
            {/*}*/}
            {
              !user &&
              <>
                {
                  loginSelect &&
                  <button type="submit">Login</button>
                }
                {
                  loginSelect &&
                  <button onClick={(e) => loginWithGoogle(e, setUser, displayError)}>
                    <img src={`${process.env.PUBLIC_URL}/g-logo.png`} className="Glogo"/>
                    Login cu mail-ul de google
                  </button>
                }
                {
                  !loginSelect &&
                  <button type="submit" onClick={(e) => signupCredentials(e, email, password, 'invitation', setUser, displayError)}>
                    Creaza cont
                  </button>
                }
              </>
            }
          </div>
        }
        { errorText && <div className='Error'>{ errorText }</div> }
      </form>
    </section>
  );
};

const UserMenu = ({user, setUser, usersList}) => {
  const [name, setName] = useState('');
  const [p5, setP5] = useState(false);
  const [errorText, setErrorText] = useState('');
  const [showUserSettings, setShowUserSettings] = useState(false);
  const [highlightSave, setHighlightSave] = useState(false);

  useEffect(() => {
    usersList[user.uid]?.name && setName(usersList[user.uid]?.name);
    usersList[user.uid]?.p5 !== undefined && setP5(usersList[user.uid]?.p5);

    if (isDifferent(user, usersList)) {
      setHighlightSave(true);
    } else {
      setHighlightSave(false);
    }
  },[user, usersList])

  useEffect(() => {
    if (isDifferent(user, usersList)) {
      setHighlightSave(true);
    } else {
      setHighlightSave(false);
    }
  }, [name, p5])

  function isDifferent(user, usersList) {
    return name && name !== usersList[user.uid]?.name || p5 !== undefined && p5 !== usersList[user.uid]?.p5
  }

  function displayError(text) {
    setErrorText(text);
    setTimeout(() => setErrorText(''), 5000);
  }

  function toggleShowSettings() {
    setShowUserSettings(!showUserSettings)
  }

  return(
    <section className="UserMenu">
      {
        user &&
        <>
          <section className={`UserMenuForm ${showUserSettings ? '' : 'Hidden'}`}>
            <form onSubmit={(e) => saveUserData(e, user.uid, name, p5, () => {}, displayError)}>
              <div className="LoginInputs">
                <section className="Checkbox">
                  <input
                    id="pentalogist"
                    placeholder=""
                    type="checkbox"
                    checked={p5}
                    onChange={(e) => {console.log(e);setP5(e.target.checked)}}
                  />
                  <label htmlFor="pentalogist">
                    <span className={`${p5 ? 'Selected' : ''}`}>Pentalogist</span>
                    &nbsp;/&nbsp;
                    <span className={`${p5 ? '' : 'Selected'}`}>Extern</span>
                  </label>
                </section>
                <input
                  className="Name"
                  placeholder="Nume"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
                <section className="Email">Email: {user.email}</section>
                <button
                  className={`Action ${highlightSave ? 'Highlight' : ''}`}
                  onClick={(e) => saveUserData(e, user.uid, name, p5, () => displayError('Salvat'), displayError)}
                >Salveaza</button>
                <button onClick={(e) => localSignOut(e, setUser, displayError)}>Deconecteaza-ma</button>
              </div>
              { errorText && <div className='Error'>{ errorText }</div> }
            </form>
          </section>
          <span onClick={toggleShowSettings} className="material-icons Trigger">manage_accounts</span>
        </>
      }
    </section>
  )
}

export default App;


async function init(auth, setUser) {
  await setPersistence(auth, browserLocalPersistence)

  onAuthStateChanged(auth, user => {
    setUser(user);
  }, (error) => {
    // Handle Errors here.
    // const errorCode = error.code;
    // const errorMessage = error.message;
    console.error(error)
  });
}

const signIn = (e, email, password, onSuccess, onError) => {
  e && e.preventDefault();
  signInWithEmailAndPassword(auth, email, password)
    .then((userCredential) => {
      const { user } = userCredential;
      window.history.pushState({ userId: user.uid }, "Fotbal Joi", "/");
      window.location.reload();
      onSuccess(user);
      return true;
    })
    .catch(error => {
      console.error(error)
      onError(error.message)
    });
}

const localSignOut = (e, onSuccess) => {
  e && e.preventDefault();
  signOut(auth).then(() => {
    onSuccess(null)
  })
}

const loginWithGoogle = (e, onSuccess, onError) => {
  e && e.preventDefault();
  signInWithPopup(auth, provider)
    .then((result) => {
      // This gives you a Google Access Token. You can use it to access the Google API.
      const credential = GoogleAuthProvider.credentialFromResult(result);
      const token = credential.accessToken;
      // The signed-in user info.
      const user = result.user;
      onSuccess(user)
      // ...
    }).catch((error) => {
      console.error(error)
    // Handle Errors here.
    const errorCode = error.code;
    onError(error.message)
    // The email of the user's account used.
    const email = error.customData.email;
    // The AuthCredential type that was used.
    const credential = GoogleAuthProvider.credentialFromError(error);
    // ...
  });
}

const signupCredentials = (e, email, password, invitation, onSuccess, onError) => {
  e && e.preventDefault();
  // if (!invitation) {
  //   onError('Ai nevoie de o invitatie pt a te inregistra')
  //   return;
  // }
  createUserWithEmailAndPassword(auth, email, password)
    .then((userCredential) => {
      const user = userCredential.user;
      onSuccess(user)
    })
    .catch((error) => {
      const errorCode = error.code;
      onError(error.message)
    });
}

const db = getDatabase(app);

function joinGame(userId, email, onSuccess, onError) {
  set(ref(db, `/games/${nextGame}/${userId}/timestamp`), new Date().getTime())
  set(ref(db, `/games/${nextGame}/${userId}/email`), email)
  // .then(() => {
  //   onSuccess()
  // })
  // .catch(error => {
  //   console.error(error)
  //   onError(error.message)
  // });
}

function leaveGame(userId, onSuccess, onError) {
  remove(ref(db, `/games/${nextGame}/${userId}/timestamp`))
    .then(() => {
      onSuccess()
    })
    .catch(error => {
      console.error(error)
      onError(error.message)
    });
}

function setExternalsCount(userId, count, onSuccess, onError) {
  set(ref(db, `/games/${nextGame}/${userId}/externals`), count)
    .then(() => {
      onSuccess()
    })
    .catch(error => {
      console.error(error)
      onError(error.message)
    });
}

function saveUserData(e, userId, name, p5, onSuccess, onError) {
  e && e.preventDefault();
  if (!name) {
    onError('Nu fi bulangiu! Pune si tu un nume sa stie omu\' cu cine joaca!');
    return;
  }

  set(ref(db, `/users/${userId}`), { name, p5 })
    .then(result => {
      console.log(result);
      onSuccess && onSuccess()
    })
    .catch(error => {
      console.error(error)
      onError && onError(error.message)
    });
}

function getStatus(userId, setAttends, onError) {
  get(child(ref(db), `/games/${nextGame}/${userId}/timestamp`)).then((snapshot) => {
    if (snapshot.exists()) {
      setAttends(true)
    } else {
      setAttends(false)
    }
  }).catch((error) => {
    console.error(error);
    onError(error.message)
  });
}

function getAttendees(onSuccess) {
  onValue(ref(db, `/games/${nextGame}`), snapshot => {
    if (snapshot.exists()) {
      onSuccess(snapshot.val())
    } else {
      onSuccess({})
    }
  });
}

function getUsersList(onSuccess) {
  onValue(ref(db, `/users`), snapshot => {
    if (snapshot.exists()) {
      onSuccess(snapshot.val())
    } else {
      onSuccess({})
    }
  });
}

function getAttendeesCount(attendees) {
  return Object.values(attendees).reduce((acc, curr) => acc + (curr.timestamp ? 1 : 0) + (+curr.externals || 0), 0)
}
